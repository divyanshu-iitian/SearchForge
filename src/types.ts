export const SEARCH_SCHEMA_VERSION = "1.0" as const;
export const READ_SCHEMA_VERSION = "1.0" as const;
export const DOCTOR_SCHEMA_VERSION = "1.0" as const;

export type Freshness = "day" | "week" | "month" | "year";
export type SafeSearch = "off" | "moderate" | "strict";
export type SearchCategory = "auto" | "web" | "code" | "academic" | "community";
export type ProviderCategory = Exclude<SearchCategory, "auto">;
export type AccessTier = "no-key" | "self-hosted" | "api-key";

export interface SearchRequest {
  query: string;
  limit?: number;
  language?: string;
  freshness?: Freshness;
  safeSearch?: SafeSearch;
  category?: SearchCategory;
  providers?: string[];
}

export interface NormalizedSearchRequest {
  query: string;
  limit: number;
  language: string;
  freshness: Freshness;
  safeSearch: SafeSearch;
  category: SearchCategory;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  source: string;
  sources: string[];
  score: number;
}

export interface ProviderStatus {
  provider: string;
  ok: boolean;
  latencyMs: number;
  resultCount: number;
  error?: string;
}

export interface SearchResponse {
  schemaVersion: typeof SEARCH_SCHEMA_VERSION;
  query: string;
  category: SearchCategory;
  results: SearchResult[];
  providers: ProviderStatus[];
  tookMs: number;
  cached: boolean;
}

export interface ProviderResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
}

export interface SearchProvider {
  readonly name: string;
  readonly categories?: readonly ProviderCategory[];
  readonly access?: AccessTier;
  readonly description?: string;
  search(request: NormalizedSearchRequest, signal?: AbortSignal): Promise<ProviderResult[]>;
  health?(signal?: AbortSignal): Promise<void>;
}

export interface ProviderInfo {
  name: string;
  categories: readonly ProviderCategory[];
  access: AccessTier;
  description?: string;
}

export interface DoctorProviderStatus extends ProviderInfo {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface DoctorResponse {
  schemaVersion: typeof DOCTOR_SCHEMA_VERSION;
  status: "ok" | "degraded";
  providers: DoctorProviderStatus[];
  reader?: {
    name: string;
    ok: boolean;
    latencyMs: number;
    error?: string;
  };
  tookMs: number;
}

export interface ReadRequest {
  url: string;
}

export interface ReadResponse {
  schemaVersion: typeof READ_SCHEMA_VERSION;
  url: string;
  content: string;
  reader: string;
  tookMs: number;
  cached: boolean;
}

export interface ContentReader {
  readonly name: string;
  read(url: URL, signal?: AbortSignal): Promise<string>;
  health?(signal?: AbortSignal): Promise<void>;
}

export interface SearchForgeOptions {
  providers: SearchProvider[];
  reader?: ContentReader;
  timeoutMs?: number;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
}
