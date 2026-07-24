import { fetchJson } from "../http-client.js";
import type { NormalizedSearchRequest, ProviderResult, SearchProvider } from "../types.js";

interface SearxResult {
  title?: string;
  url?: string;
  content?: string;
  publishedDate?: string;
}

interface SearxResponse {
  results?: SearxResult[];
}

const safeSearchMap = { off: "0", moderate: "1", strict: "2" } as const;

export class SearxngProvider implements SearchProvider {
  readonly name = "searxng";
  readonly categories = ["web"] as const;
  readonly access = "self-hosted" as const;
  readonly description = "Broad metasearch through your own SearXNG instance.";
  private readonly endpoint: URL;

  constructor(baseUrl: string) {
    this.endpoint = new URL("/search", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  }

  async search(request: NormalizedSearchRequest, signal?: AbortSignal): Promise<ProviderResult[]> {
    const url = new URL(this.endpoint);
    url.searchParams.set("q", request.query);
    url.searchParams.set("format", "json");
    url.searchParams.set("language", request.language);
    url.searchParams.set("safesearch", safeSearchMap[request.safeSearch]);
    if (request.freshness !== "week") {
      url.searchParams.set("time_range", request.freshness);
    }

    const payload = await fetchJson<SearxResponse>(this.name, url, signal ? { signal } : {});
    return (payload.results ?? [])
      .filter((item): item is SearxResult & { title: string; url: string } =>
        Boolean(item.title && item.url),
      )
      .slice(0, request.limit)
      .map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.content?.trim() ?? "",
        ...(item.publishedDate ? { publishedAt: item.publishedDate } : {}),
      }));
  }

  async health(signal?: AbortSignal): Promise<void> {
    const url = new URL(this.endpoint);
    url.searchParams.set("q", "searchforge");
    url.searchParams.set("format", "json");
    await fetchJson(this.name, url, signal ? { signal } : {});
  }
}
