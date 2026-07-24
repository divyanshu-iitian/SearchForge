import { TtlCache } from "./cache.js";
import { SearchForgeError } from "./errors.js";
import {
  DOCTOR_SCHEMA_VERSION,
  READ_SCHEMA_VERSION,
  SEARCH_SCHEMA_VERSION,
  type DoctorProviderStatus,
  type DoctorResponse,
  type ProviderInfo,
  type ProviderResult,
  type ReadResponse,
  type NormalizedSearchRequest,
  type SearchForgeOptions,
  type SearchProvider,
  type SearchRequest,
  type SearchResponse,
  type SearchResult,
} from "./types.js";
import { validatePublicUrl } from "./readers/jina.js";

const DEFAULTS = {
  limit: 8,
  language: "en",
  freshness: "month",
  safeSearch: "moderate",
} as const;

function normalizeRequest(request: SearchRequest): NormalizedSearchRequest {
  const query = request.query?.trim();
  if (!query || query.length > 500) {
    throw new SearchForgeError("query must contain 1-500 characters", "INVALID_REQUEST", 400);
  }
  const limit = request.limit ?? DEFAULTS.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new SearchForgeError("limit must be an integer between 1 and 20", "INVALID_REQUEST", 400);
  }
  const freshness = request.freshness ?? DEFAULTS.freshness;
  if (!["day", "week", "month", "year"].includes(freshness)) {
    throw new SearchForgeError("freshness must be day, week, month, or year", "INVALID_REQUEST", 400);
  }
  const safeSearch = request.safeSearch ?? DEFAULTS.safeSearch;
  if (!["off", "moderate", "strict"].includes(safeSearch)) {
    throw new SearchForgeError("safeSearch must be off, moderate, or strict", "INVALID_REQUEST", 400);
  }
  const category = request.category ?? "web";
  if (!["web", "code", "academic", "community"].includes(category)) {
    throw new SearchForgeError("category must be web, code, academic, or community", "INVALID_REQUEST", 400);
  }
  if (request.providers !== undefined && (
    !Array.isArray(request.providers)
    || request.providers.length === 0
    || request.providers.some((provider) => typeof provider !== "string" || !provider.trim())
  )) {
    throw new SearchForgeError("providers must be a non-empty array of provider names", "INVALID_REQUEST", 400);
  }
  return {
    query,
    limit,
    language: request.language?.trim() || DEFAULTS.language,
    freshness,
    safeSearch,
    category,
  };
}

function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return raw;
  }
}

function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  provider: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`${provider} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref?.();
    operation(controller.signal).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

interface Ranked {
  result: ProviderResult;
  provider: string;
  rank: number;
}

function fuse(groups: Ranked[][], limit: number): SearchResult[] {
  const merged = new Map<string, SearchResult>();
  for (const group of groups) {
    for (const { result, provider, rank } of group) {
      const key = canonicalUrl(result.url);
      const contribution = 1 / (60 + rank);
      const existing = merged.get(key);
      if (existing) {
        existing.score += contribution;
        if (!existing.sources.includes(provider)) existing.sources.push(provider);
        if (result.snippet.length > existing.snippet.length) existing.snippet = result.snippet;
      } else {
        merged.set(key, {
          title: result.title,
          url: key,
          snippet: result.snippet,
          ...(result.publishedAt ? { publishedAt: result.publishedAt } : {}),
          source: provider,
          sources: [provider],
          score: contribution,
        });
      }
    }
  }
  return [...merged.values()]
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
    .slice(0, limit)
    .map((item) => ({ ...item, score: Number(item.score.toFixed(6)) }));
}

export class SearchForge {
  private readonly providers: SearchProvider[];
  private readonly timeoutMs: number;
  private readonly cache: TtlCache<SearchResponse>;
  private readonly readCache: TtlCache<ReadResponse>;
  private readonly reader: SearchForgeOptions["reader"];

  constructor(options: SearchForgeOptions) {
    if (options.providers.length === 0) {
      throw new SearchForgeError("at least one provider is required", "CONFIGURATION_ERROR");
    }
    this.providers = options.providers;
    this.timeoutMs = options.timeoutMs ?? 8_000;
    this.cache = new TtlCache(options.cacheTtlMs ?? 300_000, options.cacheMaxEntries ?? 500);
    this.readCache = new TtlCache(options.cacheTtlMs ?? 300_000, options.cacheMaxEntries ?? 500);
    this.reader = options.reader;
  }

  providerNames(): string[] {
    return this.providers.map((provider) => provider.name);
  }

  providerInfo(): ProviderInfo[] {
    return this.providers.map((provider) => ({
      name: provider.name,
      categories: provider.categories ?? ["web"],
      access: provider.access ?? "api-key",
      ...(provider.description ? { description: provider.description } : {}),
    }));
  }

  async search(input: SearchRequest): Promise<SearchResponse> {
    const request = normalizeRequest(input);
    const requestedProviders = input.providers as string[] | undefined;
    const selected = requestedProviders
      ? this.providers.filter((provider) => requestedProviders.includes(provider.name))
      : this.providers.filter((provider) => (provider.categories ?? ["web"]).includes(request.category));
    if (selected.length === 0) {
      throw new SearchForgeError("none of the requested providers are configured", "INVALID_REQUEST", 400);
    }

    const key = JSON.stringify({ ...request, providers: selected.map((provider) => provider.name) });
    const cached = this.cache.get(key);
    if (cached) return { ...cached, cached: true };

    const startedAt = Date.now();
    const settled = await Promise.all(selected.map(async (provider) => {
      const providerStartedAt = Date.now();
      try {
        const results = await withTimeout(
          (signal) => provider.search(request, signal),
          this.timeoutMs,
          provider.name,
        );
        return {
          status: {
            provider: provider.name,
            ok: true,
            latencyMs: Date.now() - providerStartedAt,
            resultCount: results.length,
          },
          ranked: results.map((result, index) => ({ result, provider: provider.name, rank: index + 1 })),
        };
      } catch (error) {
        return {
          status: {
            provider: provider.name,
            ok: false,
            latencyMs: Date.now() - providerStartedAt,
            resultCount: 0,
            error: error instanceof Error ? error.message : "unknown provider error",
          },
          ranked: [] as Ranked[],
        };
      }
    }));

    const response: SearchResponse = {
      schemaVersion: SEARCH_SCHEMA_VERSION,
      query: request.query,
      category: request.category,
      results: fuse(settled.map((item) => item.ranked), request.limit),
      providers: settled.map((item) => item.status),
      tookMs: Date.now() - startedAt,
      cached: false,
    };
    this.cache.set(key, response);
    return response;
  }

  async read(rawUrl: string): Promise<ReadResponse> {
    if (!this.reader) {
      throw new SearchForgeError("no content reader is configured", "CONFIGURATION_ERROR", 503);
    }
    const url = validatePublicUrl(rawUrl);
    const key = url.toString();
    const cached = this.readCache.get(key);
    if (cached) return { ...cached, cached: true };
    const startedAt = Date.now();
    const content = await withTimeout(
      (signal) => this.reader!.read(url, signal),
      this.timeoutMs,
      this.reader.name,
    );
    const response: ReadResponse = {
      schemaVersion: READ_SCHEMA_VERSION,
      url: key,
      content,
      reader: this.reader.name,
      tookMs: Date.now() - startedAt,
      cached: false,
    };
    this.readCache.set(key, response);
    return response;
  }

  async doctor(): Promise<DoctorResponse> {
    const startedAt = Date.now();
    const providers = await Promise.all(this.providers.map(async (provider): Promise<DoctorProviderStatus> => {
      const providerStartedAt = Date.now();
      const info = this.providerInfo().find((item) => item.name === provider.name)!;
      try {
        if (provider.health) {
          await withTimeout((signal) => provider.health!(signal), this.timeoutMs, provider.name);
        }
        return { ...info, ok: true, latencyMs: Date.now() - providerStartedAt };
      } catch (error) {
        return {
          ...info,
          ok: false,
          latencyMs: Date.now() - providerStartedAt,
          error: error instanceof Error ? error.message : "unknown provider error",
        };
      }
    }));
    let reader: DoctorResponse["reader"];
    if (this.reader) {
      const readerStartedAt = Date.now();
      try {
        if (this.reader.health) {
          await withTimeout((signal) => this.reader!.health!(signal), this.timeoutMs, this.reader.name);
        }
        reader = { name: this.reader.name, ok: true, latencyMs: Date.now() - readerStartedAt };
      } catch (error) {
        reader = {
          name: this.reader.name,
          ok: false,
          latencyMs: Date.now() - readerStartedAt,
          error: error instanceof Error ? error.message : "unknown reader error",
        };
      }
    }
    const healthy = providers.every((provider) => provider.ok) && (!reader || reader.ok);
    return {
      schemaVersion: DOCTOR_SCHEMA_VERSION,
      status: healthy ? "ok" : "degraded",
      providers,
      ...(reader ? { reader } : {}),
      tookMs: Date.now() - startedAt,
    };
  }
}
