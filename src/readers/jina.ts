import { isIP } from "node:net";
import { SearchForgeError } from "../errors.js";
import { fetchText } from "../http-client.js";
import type { ContentReader } from "../types.js";

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (isIP(host) === 4) {
    const [a = 0, b = 0] = host.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (isIP(host) === 6) {
    return host === "::1" || host === "::" || host.startsWith("fc") || host.startsWith("fd")
      || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb");
  }
  return false;
}

export function validatePublicUrl(raw: string): URL {
  if (!raw || raw.length > 2_048) {
    throw new SearchForgeError("url must contain 1-2048 characters", "INVALID_REQUEST", 400);
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SearchForgeError("url must be a valid absolute URL", "INVALID_REQUEST", 400);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || isPrivateHost(url.hostname)) {
    throw new SearchForgeError("url must be a public HTTP or HTTPS URL", "INVALID_REQUEST", 400);
  }
  return url;
}

export class JinaReader implements ContentReader {
  readonly name = "jina-reader";

  async read(url: URL, signal?: AbortSignal): Promise<string> {
    const endpoint = new URL(`https://r.jina.ai/${url.toString()}`);
    return fetchText(this.name, endpoint, signal ? { signal } : {});
  }

  async health(signal?: AbortSignal): Promise<void> {
    await fetchText(this.name, new URL("https://r.jina.ai/https://example.com"), signal ? { signal } : {}, 100_000);
  }
}
