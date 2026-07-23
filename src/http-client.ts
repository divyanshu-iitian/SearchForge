import { ProviderError } from "./errors.js";

export async function fetchJson<T>(
  provider: string,
  url: URL,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        accept: "application/json",
        "user-agent": "SearchForge/0.1 (+https://github.com/divyanshu-iitian/SearchForge)",
        ...init.headers,
      },
    });
  } catch (error) {
    throw new ProviderError(provider, error instanceof Error ? error.message : "network failure");
  }

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    const suffix = retryAfter ? `; retry after ${retryAfter}s` : "";
    throw new ProviderError(provider, `HTTP ${response.status}${suffix}`);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ProviderError(provider, "returned invalid JSON");
  }
}
