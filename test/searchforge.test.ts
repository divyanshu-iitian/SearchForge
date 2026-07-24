import { describe, expect, it, vi } from "vitest";
import { SearchForge } from "../src/searchforge.js";
import type { ContentReader, SearchProvider } from "../src/types.js";

function provider(name: string, results: Array<{ title: string; url: string; snippet: string }>): SearchProvider {
  return { name, search: vi.fn().mockResolvedValue(results) };
}

describe("SearchForge", () => {
  it("fuses duplicate URLs and strips tracking parameters", async () => {
    const first = provider("one", [{
      title: "Result",
      url: "https://Example.com/post/?utm_source=test",
      snippet: "short",
    }]);
    const second = provider("two", [{
      title: "Same result",
      url: "https://example.com/post",
      snippet: "a more useful shared snippet",
    }]);
    const forge = new SearchForge({ providers: [first, second] });

    const response = await forge.search({ query: "test", limit: 5 });

    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.sources).toEqual(["one", "two"]);
    expect(response.results[0]?.snippet).toBe("a more useful shared snippet");
    expect(response.results[0]?.url).toBe("https://example.com/post");
  });

  it("returns partial results when a provider fails", async () => {
    const healthy = provider("healthy", [{
      title: "Available",
      url: "https://example.com",
      snippet: "still returned",
    }]);
    const failed: SearchProvider = {
      name: "failed",
      search: vi.fn().mockRejectedValue(new Error("offline")),
    };
    const response = await new SearchForge({ providers: [healthy, failed] }).search({ query: "resilience" });

    expect(response.results).toHaveLength(1);
    expect(response.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: "healthy", ok: true }),
      expect.objectContaining({ provider: "failed", ok: false, error: "offline" }),
    ]));
  });

  it("times out slow providers without blocking healthy ones", async () => {
    const slow: SearchProvider = {
      name: "slow",
      search: () => new Promise(() => undefined),
    };
    const healthy = provider("fast", []);
    const response = await new SearchForge({ providers: [slow, healthy], timeoutMs: 5 })
      .search({ query: "timeouts" });

    expect(response.providers.find((item) => item.provider === "slow")).toMatchObject({ ok: false });
  });

  it("caches identical searches", async () => {
    const source = provider("source", []);
    const forge = new SearchForge({ providers: [source], cacheTtlMs: 10_000 });
    await forge.search({ query: "cache me" });
    const second = await forge.search({ query: "cache me" });

    expect(second.cached).toBe(true);
    expect(source.search).toHaveBeenCalledTimes(1);
  });

  it("validates query, limits, and provider selection", async () => {
    const forge = new SearchForge({ providers: [provider("source", [])] });
    await expect(forge.search({ query: " " })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(forge.search({ query: "ok", limit: 21 })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(forge.search({ query: "ok", providers: ["missing"] }))
      .rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(forge.search({ query: "ok", freshness: "forever" as never }))
      .rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(forge.search({ query: "ok", providers: "source" as never }))
      .rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(forge.search({ query: "ok", category: "images" as never }))
      .rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("routes requests by capability while explicit providers override the category", async () => {
    const web = { ...provider("web", []), categories: ["web"] as const };
    const code = { ...provider("code", []), categories: ["code"] as const };
    const forge = new SearchForge({ providers: [web, code] });

    await forge.search({ query: "routing", category: "code" });
    await forge.search({ query: "override", category: "web", providers: ["code"] });

    expect(web.search).not.toHaveBeenCalled();
    expect(code.search).toHaveBeenCalledTimes(2);
  });

  it("reads and caches public URLs but rejects local targets", async () => {
    const reader: ContentReader = {
      name: "fixture-reader",
      read: vi.fn().mockResolvedValue("# Clean content"),
    };
    const forge = new SearchForge({ providers: [provider("source", [])], reader });

    const first = await forge.read("https://example.com/article");
    const second = await forge.read("https://example.com/article");

    expect(first.content).toBe("# Clean content");
    expect(second.cached).toBe(true);
    expect(reader.read).toHaveBeenCalledTimes(1);
    await expect(forge.read("http://127.0.0.1/admin"))
      .rejects.toMatchObject({ code: "INVALID_REQUEST" });
    await expect(forge.read("file:///etc/passwd"))
      .rejects.toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("reports degraded doctor status without hiding healthy capabilities", async () => {
    const healthy: SearchProvider = {
      ...provider("healthy", []),
      health: vi.fn().mockResolvedValue(undefined),
    };
    const broken: SearchProvider = {
      ...provider("broken", []),
      health: vi.fn().mockRejectedValue(new Error("unreachable")),
    };
    const response = await new SearchForge({ providers: [healthy, broken] }).doctor();

    expect(response.status).toBe("degraded");
    expect(response.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "healthy", ok: true }),
      expect.objectContaining({ name: "broken", ok: false, error: "unreachable" }),
    ]));
  });
});
