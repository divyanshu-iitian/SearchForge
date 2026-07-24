import { afterEach, describe, expect, it, vi } from "vitest";
import { BraveProvider } from "../src/providers/brave.js";
import { CrossrefProvider } from "../src/providers/crossref.js";
import { GithubProvider } from "../src/providers/github.js";
import { HackerNewsProvider } from "../src/providers/hackernews.js";
import { SearxngProvider } from "../src/providers/searxng.js";
import { WikipediaProvider } from "../src/providers/wikipedia.js";

const request = {
  query: "open source search",
  limit: 3,
  language: "en",
  freshness: "month" as const,
  safeSearch: "moderate" as const,
  category: "web" as const,
};

afterEach(() => vi.unstubAllGlobals());

describe("provider adapters", () => {
  it("normalizes SearXNG results", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [{ title: "SearXNG", url: "https://searxng.org", content: "Private metasearch" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await new SearxngProvider("http://localhost:8080").search(request);

    expect(results[0]).toMatchObject({ title: "SearXNG", snippet: "Private metasearch" });
    const calledUrl = fetchMock.mock.calls[0]?.[0] as URL;
    expect(calledUrl.searchParams.get("format")).toBe("json");
    expect(calledUrl.searchParams.get("safesearch")).toBe("1");
  });

  it("sends Brave credentials as a header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      web: { results: [{ title: "Brave", url: "https://brave.com", description: "Independent index" }] },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await new BraveProvider("secret").search(request);

    expect(results).toHaveLength(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ "x-subscription-token": "secret" }),
    });
  });

  it("sanitizes Wikipedia snippets", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      query: { search: [{ title: "Search engine", snippet: "A <span>web</span> &amp; retrieval system" }] },
    }), { status: 200 })));

    const results = await new WikipediaProvider().search(request);

    expect(results[0]?.snippet).toBe("A web & retrieval system");
    expect(results[0]?.url).toContain("Search_engine");
  });

  it("turns non-2xx responses into provider errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("busy", {
      status: 429,
      headers: { "retry-after": "5" },
    })));

    await expect(new WikipediaProvider().search(request))
      .rejects.toThrow("HTTP 429; retry after 5s");
  });

  it("normalizes public GitHub repository search without requiring a token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{
        full_name: "owner/project",
        html_url: "https://github.com/owner/project",
        description: "Useful agent tool",
        language: "TypeScript",
        stargazers_count: 42,
        updated_at: "2026-07-01T00:00:00Z",
      }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await new GithubProvider().search({ ...request, category: "code" });

    expect(results[0]).toMatchObject({
      title: "owner/project",
      snippet: "Useful agent tool · TypeScript · 42 stars",
    });
    expect(fetchMock.mock.calls[0]?.[1]).not.toMatchObject({
      headers: expect.objectContaining({ authorization: expect.anything() }),
    });
  });

  it("normalizes Crossref scholarly metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      message: { items: [{
        title: ["Retrieval systems"],
        DOI: "10.1000/example",
        publisher: "Example Press",
        author: [{ given: "Ada", family: "Lovelace" }],
        published: { "date-parts": [[2025, 3, 1]] },
      }] },
    }), { status: 200 })));

    const results = await new CrossrefProvider("maintainer@example.com")
      .search({ ...request, category: "academic" });

    expect(results[0]).toMatchObject({
      title: "Retrieval systems",
      url: "https://doi.org/10.1000/example",
      publishedAt: "2025-01-01",
    });
  });

  it("falls back to a Hacker News discussion URL", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      hits: [{ objectID: "123", story_title: "Agent search", comment_text: "<p>Useful thread</p>" }],
    }), { status: 200 })));

    const results = await new HackerNewsProvider().search({ ...request, category: "community" });

    expect(results[0]).toMatchObject({
      title: "Agent search",
      url: "https://news.ycombinator.com/item?id=123",
      snippet: "Useful thread",
    });
  });
});
