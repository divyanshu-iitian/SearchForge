import { fetchJson } from "../http-client.js";
import type { ProviderResult, SearchProvider, SearchRequest } from "../types.js";

interface WikipediaResponse {
  query?: {
    search?: Array<{
      title: string;
      snippet: string;
      timestamp?: string;
    }>;
  };
}

function stripMarkup(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export class WikipediaProvider implements SearchProvider {
  readonly name = "wikipedia";

  async search(request: Required<Omit<SearchRequest, "providers">>): Promise<ProviderResult[]> {
    const language = /^[a-z]{2,3}$/i.test(request.language) ? request.language.toLowerCase() : "en";
    const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "search");
    url.searchParams.set("srsearch", request.query);
    url.searchParams.set("srlimit", String(request.limit));
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");

    const payload = await fetchJson<WikipediaResponse>(this.name, url);
    return (payload.query?.search ?? []).map((item) => ({
      title: item.title,
      url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
      snippet: stripMarkup(item.snippet),
      ...(item.timestamp ? { publishedAt: item.timestamp } : {}),
    }));
  }
}
