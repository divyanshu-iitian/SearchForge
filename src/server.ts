import { timingSafeEqual, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { SearchForgeError } from "./errors.js";
import type { SearchForge } from "./searchforge.js";
import type { SearchRequest } from "./types.js";

interface ServerOptions {
  port: number;
  host?: string;
  apiKey?: string;
  rateLimitPerMinute?: number;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

function sendJson(response: ServerResponse, status: number, body: unknown, requestId: string): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "x-request-id": requestId,
    "x-content-type-options": "nosniff",
    "cache-control": "no-store",
  });
  response.end(payload);
}

async function readJson(request: IncomingMessage, maxBytes = 32_768): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > maxBytes) throw new SearchForgeError("request body is too large", "PAYLOAD_TOO_LARGE", 413);
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new SearchForgeError("request body must be valid JSON", "INVALID_JSON", 400);
  }
}

function authorized(request: IncomingMessage, expected: string | undefined): boolean {
  if (!expected) return true;
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, "")
    ?? (Array.isArray(request.headers["x-api-key"])
      ? request.headers["x-api-key"][0]
      : request.headers["x-api-key"]);
  if (!supplied) return false;
  const actualBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function startServer(searchForge: SearchForge, options: ServerOptions) {
  const buckets = new Map<string, RateBucket>();
  const rateLimit = options.rateLimitPerMinute ?? 60;

  const server = createServer(async (request, response) => {
    const requestId = request.headers["x-request-id"]?.toString().slice(0, 128) || randomUUID();
    const startedAt = Date.now();
    const client = request.socket.remoteAddress ?? "unknown";
    const log = (status: number) => {
      process.stdout.write(`${JSON.stringify({
        level: "info",
        event: "http_request",
        requestId,
        method: request.method,
        path: request.url,
        status,
        durationMs: Date.now() - startedAt,
      })}\n`);
    };

    try {
      const url = new URL(request.url ?? "/", "http://searchforge.local");
      if (request.method === "GET" && url.pathname === "/healthz") {
        sendJson(response, 200, { status: "ok", providers: searchForge.providerNames() }, requestId);
        log(200);
        return;
      }

      if (!authorized(request, options.apiKey)) {
        sendJson(response, 401, { error: { code: "UNAUTHORIZED", message: "invalid API key" } }, requestId);
        log(401);
        return;
      }

      const now = Date.now();
      if (buckets.size > 10_000) {
        for (const [key, value] of buckets) {
          if (value.resetAt <= now) buckets.delete(key);
        }
      }
      const bucket = buckets.get(client);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(client, { count: 1, resetAt: now + 60_000 });
      } else if (bucket.count >= rateLimit) {
        response.setHeader("retry-after", String(Math.ceil((bucket.resetAt - now) / 1_000)));
        sendJson(response, 429, { error: { code: "RATE_LIMITED", message: "rate limit exceeded" } }, requestId);
        log(429);
        return;
      } else {
        bucket.count += 1;
      }

      if (request.method === "GET" && url.pathname === "/v1/providers") {
        sendJson(response, 200, { providers: searchForge.providerNames() }, requestId);
        log(200);
        return;
      }
      if (request.method === "POST" && url.pathname === "/v1/search") {
        const body = await readJson(request);
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          throw new SearchForgeError("request body must be an object", "INVALID_REQUEST", 400);
        }
        const result = await searchForge.search(body as SearchRequest);
        sendJson(response, 200, result, requestId);
        log(200);
        return;
      }

      sendJson(response, 404, { error: { code: "NOT_FOUND", message: "route not found" } }, requestId);
      log(404);
    } catch (error) {
      const known = error instanceof SearchForgeError;
      const status = known ? error.status : 500;
      sendJson(response, status, {
        error: {
          code: known ? error.code : "INTERNAL_ERROR",
          message: known ? error.message : "internal server error",
        },
      }, requestId);
      log(status);
    }
  });

  server.listen(options.port, options.host ?? "127.0.0.1", () => {
    process.stdout.write(`${JSON.stringify({
      level: "info",
      event: "server_started",
      host: options.host ?? "127.0.0.1",
      port: options.port,
      providers: searchForge.providerNames(),
    })}\n`);
  });
  return server;
}
