#!/usr/bin/env node
import { createSearchForgeFromEnv } from "./config.js";
import { SearchForgeError } from "./errors.js";
import { startServer } from "./server.js";
import type { Freshness, SafeSearch, SearchCategory } from "./types.js";

function help(): string {
  return `SearchForge — open web search for LLMs, agents, and RAG

Usage:
  searchforge search <query> [--category auto|web|code|academic|community] [--limit 8] [--json]
  searchforge read <url> [--json]
  searchforge doctor [--json]
  searchforge serve [--port 3000] [--host 127.0.0.1]
  searchforge providers
  searchforge-mcp

Environment:
  SEARCHFORGE_SEARXNG_URL   Self-hosted SearXNG endpoint
  GITHUB_TOKEN              Optional; raises GitHub public API quota
  CROSSREF_MAILTO           Optional; enables Crossref polite-pool routing
  BRAVE_SEARCH_API_KEY      Optional Brave Search API key
  SEARCHFORGE_API_KEY       Optional REST API bearer key
  SEARCHFORGE_TIMEOUT_MS    Per-provider timeout (default: 8000)

Examples:
  searchforge search "open source vector databases" --limit 5
  searchforge search "agent memory" --category academic
  searchforge read "https://example.com/article"
  SEARCHFORGE_SEARXNG_URL=http://localhost:8080 searchforge serve
`;
}

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function intValue(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function render(response: Awaited<ReturnType<ReturnType<typeof createSearchForgeFromEnv>["search"]>>): string {
  const lines = [`Search results for "${response.query}" (${response.tookMs}ms${response.cached ? ", cached" : ""})`, ""];
  response.results.forEach((result, index) => {
    lines.push(`${index + 1}. ${result.title}`);
    lines.push(`   ${result.url}`);
    if (result.snippet) lines.push(`   ${result.snippet}`);
    lines.push(`   via ${result.sources.join(", ")}`);
    lines.push("");
  });
  const failed = response.providers.filter((provider) => !provider.ok);
  if (failed.length) lines.push(`Partial provider failures: ${failed.map((item) => item.provider).join(", ")}`);
  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(help());
    return;
  }

  const searchForge = createSearchForgeFromEnv();
  if (command === "providers") {
    process.stdout.write(`${JSON.stringify(searchForge.providerInfo(), null, 2)}\n`);
    return;
  }
  if (command === "doctor") {
    const response = await searchForge.doctor();
    process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
    if (response.status === "degraded") process.exitCode = 1;
    return;
  }
  if (command === "read") {
    const url = args[1];
    if (!url || url.startsWith("--")) {
      throw new SearchForgeError("read requires a URL", "INVALID_REQUEST", 400);
    }
    const response = await searchForge.read(url);
    process.stdout.write(args.includes("--json") ? `${JSON.stringify(response, null, 2)}\n` : response.content);
    return;
  }
  if (command === "serve") {
    const port = intValue(valueAfter(args, "--port") ?? process.env.SEARCHFORGE_PORT, 3000);
    const host = valueAfter(args, "--host") ?? process.env.SEARCHFORGE_HOST ?? "127.0.0.1";
    startServer(searchForge, {
      port,
      host,
      ...(process.env.SEARCHFORGE_API_KEY ? { apiKey: process.env.SEARCHFORGE_API_KEY } : {}),
      rateLimitPerMinute: intValue(process.env.SEARCHFORGE_RATE_LIMIT, 60),
    });
    return;
  }
  if (command === "search") {
    const query = args[1];
    if (!query || query.startsWith("--")) {
      throw new SearchForgeError("search requires a query", "INVALID_REQUEST", 400);
    }
    const response = await searchForge.search({
      query,
      limit: intValue(valueAfter(args, "--limit"), 8),
      language: valueAfter(args, "--language") ?? "en",
      freshness: (valueAfter(args, "--freshness") ?? "month") as Freshness,
      safeSearch: (valueAfter(args, "--safe-search") ?? "moderate") as SafeSearch,
      category: (valueAfter(args, "--category") ?? "auto") as SearchCategory,
    });
    process.stdout.write(args.includes("--json") ? `${JSON.stringify(response, null, 2)}\n` : render(response));
    return;
  }
  throw new SearchForgeError(`unknown command: ${command}`, "INVALID_REQUEST", 400);
}

main().catch((error: unknown) => {
  process.stderr.write(`SearchForge: ${error instanceof Error ? error.message : "unknown error"}\n`);
  process.exitCode = 1;
});
