import { fetchJson } from "../http-client.js";
import type { NormalizedSearchRequest, ProviderResult, SearchProvider } from "../types.js";

interface CrossrefResponse {
  message?: {
    items?: Array<{
      title?: string[];
      URL?: string;
      DOI?: string;
      abstract?: string;
      publisher?: string;
      type?: string;
      author?: Array<{ given?: string; family?: string }>;
      published?: { "date-parts"?: number[][] };
    }>;
  };
}

function clean(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export class CrossrefProvider implements SearchProvider {
  readonly name = "crossref";
  readonly categories = ["academic"] as const;
  readonly access = "no-key" as const;
  readonly description = "Scholarly works and DOI metadata from Crossref's public REST API.";

  constructor(private readonly mailto?: string) {}

  private url(query: string, rows: number): URL {
    const url = new URL("https://api.crossref.org/works");
    url.searchParams.set("query", query);
    url.searchParams.set("rows", String(rows));
    if (this.mailto) url.searchParams.set("mailto", this.mailto);
    return url;
  }

  async search(request: NormalizedSearchRequest, signal?: AbortSignal): Promise<ProviderResult[]> {
    const payload = await fetchJson<CrossrefResponse>(
      this.name,
      this.url(request.query, request.limit),
      signal ? { signal } : {},
    );
    return (payload.message?.items ?? []).flatMap((item) => {
      const title = item.title?.[0]?.trim();
      const url = item.URL ?? (item.DOI ? `https://doi.org/${item.DOI}` : undefined);
      if (!title || !url) return [];
      const author = item.author?.slice(0, 3)
        .map((person) => [person.given, person.family].filter(Boolean).join(" "))
        .filter(Boolean)
        .join(", ");
      const year = item.published?.["date-parts"]?.[0]?.[0];
      return [{
        title,
        url,
        snippet: clean(item.abstract ?? [author, item.publisher, item.type].filter(Boolean).join(" · ")),
        ...(year ? { publishedAt: `${year}-01-01` } : {}),
      }];
    });
  }

  async health(signal?: AbortSignal): Promise<void> {
    await fetchJson(this.name, this.url("searchforge", 0), signal ? { signal } : {});
  }
}
