import { fetchJson } from "../http-client.js";
import type { NormalizedSearchRequest, ProviderResult, SearchProvider } from "../types.js";

interface HackerNewsResponse {
  hits?: Array<{
    objectID?: string;
    title?: string | null;
    story_title?: string | null;
    url?: string | null;
    story_url?: string | null;
    comment_text?: string | null;
    created_at?: string;
  }>;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/&[^;]+;/g, " ").replace(/\s+/g, " ").trim();
}

export class HackerNewsProvider implements SearchProvider {
  readonly name = "hackernews";
  readonly categories = ["community"] as const;
  readonly access = "no-key" as const;
  readonly description = "Hacker News stories and discussions via the community Algolia API.";

  private url(query: string, limit: number): URL {
    const url = new URL("https://hn.algolia.com/api/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("hitsPerPage", String(limit));
    return url;
  }

  async search(request: NormalizedSearchRequest, signal?: AbortSignal): Promise<ProviderResult[]> {
    const payload = await fetchJson<HackerNewsResponse>(
      this.name,
      this.url(request.query, request.limit),
      signal ? { signal } : {},
    );
    return (payload.hits ?? []).flatMap((item) => {
      const title = item.title ?? item.story_title;
      if (!title || !item.objectID) return [];
      return [{
        title,
        url: item.url ?? item.story_url ?? `https://news.ycombinator.com/item?id=${item.objectID}`,
        snippet: stripHtml(item.comment_text ?? ""),
        ...(item.created_at ? { publishedAt: item.created_at } : {}),
      }];
    });
  }

  async health(signal?: AbortSignal): Promise<void> {
    await fetchJson(this.name, this.url("searchforge", 0), signal ? { signal } : {});
  }
}
