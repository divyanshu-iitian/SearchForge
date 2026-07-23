export const SEARCH_SCHEMA_VERSION = "1.0" as const;

export type Freshness = "day" | "week" | "month" | "year";
export type SafeSearch = "off" | "moderate" | "strict";

export interface SearchRequest {
  query: string;
  limit?: number;
  language?: string;
  freshness?: Freshness;
  safeSearch?: SafeSearch;
  providers?: string[];
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
  search(request: Required<Omit<SearchRequest, "providers">>): Promise<ProviderResult[]>;
}

export interface SearchForgeOptions {
  providers: SearchProvider[];
  timeoutMs?: number;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
}
