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
        "user-agent": "SearchForge/0.2 (+https://github.com/divyanshu-iitian/SearchForge)",
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

export async function fetchText(
  provider: string,
  url: URL,
  init: RequestInit = {},
  maxBytes = 2_000_000,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        accept: "text/markdown, text/plain;q=0.9",
        "user-agent": "SearchForge/0.2 (+https://github.com/divyanshu-iitian/SearchForge)",
        ...init.headers,
      },
    });
  } catch (error) {
    throw new ProviderError(provider, error instanceof Error ? error.message : "network failure");
  }
  if (!response.ok) throw new ProviderError(provider, `HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ProviderError(provider, `response exceeds ${maxBytes} bytes`);
  }
  const content = await response.text();
  if (Buffer.byteLength(content) > maxBytes) {
    throw new ProviderError(provider, `response exceeds ${maxBytes} bytes`);
  }
  return content;
}
