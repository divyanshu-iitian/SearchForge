import { fetchJson } from "../http-client.js";
import type { ProviderResult, SearchProvider, SearchRequest } from "../types.js";

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
  private readonly endpoint: URL;

  constructor(baseUrl: string) {
    this.endpoint = new URL("/search", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  }

  async search(request: Required<Omit<SearchRequest, "providers">>): Promise<ProviderResult[]> {
    const url = new URL(this.endpoint);
    url.searchParams.set("q", request.query);
    url.searchParams.set("format", "json");
    url.searchParams.set("language", request.language);
    url.searchParams.set("safesearch", safeSearchMap[request.safeSearch]);
    if (request.freshness !== "week") {
      url.searchParams.set("time_range", request.freshness);
    }

    const payload = await fetchJson<SearxResponse>(this.name, url);
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
}
