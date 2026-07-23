import { fetchJson } from "../http-client.js";
import type { ProviderResult, SearchProvider, SearchRequest } from "../types.js";

interface BraveResponse {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
      page_age?: string;
    }>;
  };
}

const freshnessMap = { day: "pd", week: "pw", month: "pm", year: "py" } as const;

export class BraveProvider implements SearchProvider {
  readonly name = "brave";

  constructor(private readonly apiKey: string) {}

  async search(request: Required<Omit<SearchRequest, "providers">>): Promise<ProviderResult[]> {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", request.query);
    url.searchParams.set("count", String(request.limit));
    url.searchParams.set("search_lang", request.language.split("-")[0] ?? "en");
    url.searchParams.set("safesearch", request.safeSearch === "off" ? "off" : "moderate");
    url.searchParams.set("freshness", freshnessMap[request.freshness]);

    const payload = await fetchJson<BraveResponse>(this.name, url, {
      headers: { "x-subscription-token": this.apiKey },
    });

    return (payload.web?.results ?? [])
      .filter((item): item is { title: string; url: string; description?: string; page_age?: string } =>
        Boolean(item.title && item.url),
      )
      .map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.description?.trim() ?? "",
        ...(item.page_age ? { publishedAt: item.page_age } : {}),
      }));
  }
}
