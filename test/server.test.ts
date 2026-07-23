import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchForge } from "../src/searchforge.js";
import { startServer } from "../src/server.js";
import type { SearchProvider } from "../src/types.js";

const source: SearchProvider = {
  name: "fixture",
  search: vi.fn().mockResolvedValue([{
    title: "Fixture",
    url: "https://example.com",
    snippet: "Test result",
  }]),
};

const servers: ReturnType<typeof startServer>[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function serverUrl(apiKey?: string): Promise<string> {
  const server = startServer(new SearchForge({ providers: [source] }), {
    port: 0,
    host: "127.0.0.1",
    ...(apiKey ? { apiKey } : {}),
  });
  servers.push(server);
  await once(server, "listening");
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("REST server", () => {
  it("serves health and search endpoints", async () => {
    const base = await serverUrl();
    const health = await fetch(`${base}/healthz`).then((response) => response.json());
    const search = await fetch(`${base}/v1/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "hello" }),
    }).then((response) => response.json());

    expect(health).toEqual({ status: "ok", providers: ["fixture"] });
    expect(search.results[0]).toMatchObject({ title: "Fixture" });
  });

  it("enforces optional API key authentication", async () => {
    const base = await serverUrl("top-secret");
    const denied = await fetch(`${base}/v1/providers`);
    const allowed = await fetch(`${base}/v1/providers`, {
      headers: { authorization: "Bearer top-secret" },
    });

    expect(denied.status).toBe(401);
    expect(allowed.status).toBe(200);
  });

  it("returns structured validation errors", async () => {
    const base = await serverUrl();
    const response = await fetch(`${base}/v1/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_REQUEST" },
    });
  });
});
