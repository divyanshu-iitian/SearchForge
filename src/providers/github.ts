import { fetchJson } from "../http-client.js";
import type { NormalizedSearchRequest, ProviderResult, SearchProvider } from "../types.js";

interface GithubResponse {
  items?: Array<{
    full_name?: string;
    html_url?: string;
    description?: string | null;
    language?: string | null;
    stargazers_count?: number;
    updated_at?: string;
    license?: { spdx_id?: string | null } | null;
  }>;
}

export class GithubProvider implements SearchProvider {
  readonly name = "github";
  readonly categories = ["code"] as const;
  readonly access = "no-key" as const;
  readonly description = "Public repository search; optional token raises GitHub's rate limit.";

  constructor(private readonly token?: string) {}

  private init(signal?: AbortSignal): RequestInit {
    return {
      ...(signal ? { signal } : {}),
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
    };
  }

  async search(request: NormalizedSearchRequest, signal?: AbortSignal): Promise<ProviderResult[]> {
    const url = new URL("https://api.github.com/search/repositories");
    url.searchParams.set("q", request.query);
    url.searchParams.set("per_page", String(request.limit));
    const payload = await fetchJson<GithubResponse>(this.name, url, this.init(signal));
    return (payload.items ?? [])
      .filter((item): item is typeof item & { full_name: string; html_url: string } =>
        Boolean(item.full_name && item.html_url))
      .map((item) => ({
        title: item.full_name,
        url: item.html_url,
        snippet: [
          item.description?.trim(),
          item.language,
          typeof item.stargazers_count === "number" ? `${item.stargazers_count} stars` : undefined,
          item.license?.spdx_id,
        ].filter(Boolean).join(" · "),
        ...(item.updated_at ? { publishedAt: item.updated_at } : {}),
      }));
  }

  async health(signal?: AbortSignal): Promise<void> {
    await fetchJson(this.name, new URL("https://api.github.com/rate_limit"), this.init(signal));
  }
}
