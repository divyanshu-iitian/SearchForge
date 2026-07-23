import { BraveProvider } from "./providers/brave.js";
import { SearxngProvider } from "./providers/searxng.js";
import { WikipediaProvider } from "./providers/wikipedia.js";
import { SearchForge } from "./searchforge.js";

function positiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createSearchForgeFromEnv(env: NodeJS.ProcessEnv = process.env): SearchForge {
  const providers = [];
  if (env.SEARCHFORGE_SEARXNG_URL) {
    providers.push(new SearxngProvider(env.SEARCHFORGE_SEARXNG_URL));
  }
  if (env.BRAVE_SEARCH_API_KEY) {
    providers.push(new BraveProvider(env.BRAVE_SEARCH_API_KEY));
  }
  providers.push(new WikipediaProvider());

  return new SearchForge({
    providers,
    timeoutMs: positiveInt(env.SEARCHFORGE_TIMEOUT_MS, 8_000),
    cacheTtlMs: positiveInt(env.SEARCHFORGE_CACHE_TTL_MS, 300_000),
    cacheMaxEntries: positiveInt(env.SEARCHFORGE_CACHE_MAX_ENTRIES, 500),
  });
}
