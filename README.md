<div align="center">

# SearchForge

### One open web-search layer for every LLM, agent, and RAG pipeline.

[![CI](https://github.com/divyanshu-iitian/SearchForge/actions/workflows/ci.yml/badge.svg)](https://github.com/divyanshu-iitian/SearchForge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-22c55e.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=nodedotjs&logoColor=white)](package.json)
[![MCP](https://img.shields.io/badge/MCP-ready-8b5cf6)](https://modelcontextprotocol.io)

**Self-host with SearXNG. Add optional providers. Get clean, ranked, citation-ready JSON through REST, MCP, CLI, or a TypeScript SDK.**

[Quick start](#quick-start) · [MCP setup](#mcp) · [REST API](#rest-api) · [Architecture](#how-it-works) · [Contributing](CONTRIBUTING.md)

</div>

---

LLMs do not need another answer engine. They need **reliable search evidence**.

SearchForge is a provider-neutral search gateway for developers building RAG, agents, research assistants, and local AI systems. It queries multiple search backends concurrently, survives partial outages, removes duplicate URLs, fuses rankings, and returns a stable response with source provenance.

It does **not** call an LLM, generate uncited prose, track users, or lock your application to one search vendor.

## Why SearchForge?

| Problem | SearchForge |
|---|---|
| Every search API has a different schema | One versioned result schema |
| Free public instances are unreliable | Self-hosted SearXNG is the primary path |
| One provider outage breaks the RAG request | Partial failures are isolated and reported |
| Results repeat across providers | Canonical URL deduplication |
| Rank values cannot be compared directly | Reciprocal Rank Fusion |
| Agent integrations are fragmented | REST + MCP + CLI + TypeScript |
| Search calls become an uncontrolled cost | TTL cache, limits, timeouts, provider selection |

## Quick start

### The recommended path: SearchForge + SearXNG

```bash
git clone https://github.com/divyanshu-iitian/SearchForge.git
cd SearchForge
docker compose up --build
```

Search:

```bash
curl -s http://localhost:3000/v1/search \
  -H "content-type: application/json" \
  -d '{"query":"open source vector databases","limit":5}'
```

This starts:

- SearchForge at `http://localhost:3000`
- a private SearXNG instance at `http://localhost:8080`
- JSON search enabled for machine consumption
- health checks and automatic restarts

> Before exposing this stack publicly, replace the SearXNG secret, set `SEARCHFORGE_API_KEY`, and put the service behind TLS.

### Run locally without Docker

```bash
npm install
npm run build

# No-key Wikipedia fallback
node dist/cli.js search "retrieval augmented generation"

# Full web search through your SearXNG instance
SEARCHFORGE_SEARXNG_URL=http://localhost:8080 node dist/cli.js search "latest MCP specification"
```

On PowerShell:

```powershell
$env:SEARCHFORGE_SEARXNG_URL="http://localhost:8080"
node dist/cli.js search "latest MCP specification"
```

## Four integration surfaces

### REST API

```http
POST /v1/search
Content-Type: application/json
Authorization: Bearer your-optional-api-key

{
  "query": "open source reranking models",
  "limit": 8,
  "language": "en",
  "freshness": "month",
  "safeSearch": "moderate",
  "providers": ["searxng", "brave", "wikipedia"]
}
```

Response:

```json
{
  "schemaVersion": "1.0",
  "query": "open source reranking models",
  "results": [
    {
      "title": "Example result",
      "url": "https://example.com/research",
      "snippet": "A citation-ready passage from the provider.",
      "source": "searxng",
      "sources": ["searxng", "brave"],
      "score": 0.032787
    }
  ],
  "providers": [
    {
      "provider": "searxng",
      "ok": true,
      "latencyMs": 241,
      "resultCount": 8
    }
  ],
  "tookMs": 243,
  "cached": false
}
```

Other endpoints:

```text
GET /healthz       liveness and configured providers
GET /v1/providers  provider discovery
```

The full contract is in [openapi.yaml](openapi.yaml).

### MCP

SearchForge exposes a `web_search` tool over stdio using the official Model Context Protocol SDK.

Build once:

```bash
npm install
npm run build
```

Add it to an MCP-compatible client:

```json
{
  "mcpServers": {
    "searchforge": {
      "command": "node",
      "args": ["/absolute/path/to/SearchForge/dist/mcp.js"],
      "env": {
        "SEARCHFORGE_SEARXNG_URL": "http://localhost:8080"
      }
    }
  }
}
```

The tool returns both text content and structured output, so clients can display it or feed it directly into retrieval.

### TypeScript SDK

```ts
import {
  SearchForge,
  SearxngProvider,
  WikipediaProvider,
} from "searchforge-rag";

const search = new SearchForge({
  providers: [
    new SearxngProvider("http://localhost:8080"),
    new WikipediaProvider(),
  ],
  timeoutMs: 8_000,
  cacheTtlMs: 300_000,
});

const evidence = await search.search({
  query: "hybrid retrieval techniques",
  limit: 10,
});
```

Until the npm package is published, install directly from GitHub:

```bash
npm install github:divyanshu-iitian/SearchForge
```

### CLI

```bash
searchforge providers
searchforge search "small language model benchmarks" --limit 5
searchforge search "AI regulation" --freshness week --json
searchforge serve --host 0.0.0.0 --port 3000
```

## Providers

| Provider | Key | Role | Enabled when |
|---|---:|---|---|
| [SearXNG](https://docs.searxng.org/) | No | Recommended self-hosted full-web metasearch | `SEARCHFORGE_SEARXNG_URL` is set |
| [Brave Search](https://brave.com/search/api/) | Yes | Independent commercial web index with monthly free credits | `BRAVE_SEARCH_API_KEY` is set |
| Wikipedia | No | Reliable knowledge fallback, not a full-web index | Always |

Public SearXNG instances commonly disable JSON or rate-limit automation. SearchForge intentionally recommends self-hosting instead of silently abusing community infrastructure.

Adding a provider requires one small adapter:

```ts
import type { SearchProvider } from "searchforge-rag";

export const myProvider: SearchProvider = {
  name: "my-provider",
  async search(request) {
    return [{
      title: "Result title",
      url: "https://example.com",
      snippet: "Useful evidence",
    }];
  },
};
```

## How it works

```text
RAG / agent / MCP client
          │
          ▼
  validated SearchRequest
          │
    ┌─────┼──────────┐
    ▼     ▼          ▼
 SearXNG Brave   Wikipedia
    │     │          │
    └─────┼──────────┘
          ▼
 normalize → canonicalize → deduplicate → reciprocal-rank fusion
          │
          ▼
 versioned evidence + URLs + provider health
```

Provider calls run concurrently with independent timeouts. A failed provider is recorded in `providers` without discarding healthy results. Duplicate tracking URLs collapse into one result while retaining every contributing provider in `sources`.

## Configuration

| Environment variable | Default | Purpose |
|---|---:|---|
| `SEARCHFORGE_SEARXNG_URL` | unset | SearXNG base URL |
| `BRAVE_SEARCH_API_KEY` | unset | Optional Brave provider |
| `SEARCHFORGE_API_KEY` | unset | REST bearer or `x-api-key` authentication |
| `SEARCHFORGE_PORT` | `3000` | REST port |
| `SEARCHFORGE_HOST` | `127.0.0.1` | Bind address |
| `SEARCHFORGE_TIMEOUT_MS` | `8000` | Independent provider timeout |
| `SEARCHFORGE_CACHE_TTL_MS` | `300000` | In-memory result cache TTL |
| `SEARCHFORGE_CACHE_MAX_ENTRIES` | `500` | Cache size bound |
| `SEARCHFORGE_RATE_LIMIT` | `60` | Requests per client IP per minute |

## Production notes

- Set an API key before binding to a public interface.
- Terminate TLS at a trusted reverse proxy.
- Keep SearXNG private to the SearchForge network when possible.
- The built-in cache and rate limiter are process-local. Use an external gateway/cache for multi-replica deployments.
- Search snippets are **untrusted external input**. Never place them into a system prompt without delimiters and prompt-injection defenses.
- Provider errors intentionally omit secrets and response bodies.
- SearchForge retrieves result metadata and snippets; it does not crawl result pages.

See [SECURITY.md](SECURITY.md) for the threat boundary.

## Roadmap

- [ ] Additional community-reviewed providers
- [ ] Optional document extraction with strict SSRF protections
- [ ] Streaming HTTP MCP transport
- [ ] OpenTelemetry metrics hooks
- [ ] Persistent Redis-compatible cache adapter
- [ ] Evaluation fixtures for result quality and freshness

Contributions should improve user outcomes, not inflate the provider count. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

## Principles

1. **Evidence over generated answers**
2. **Self-hosting over hidden dependence**
3. **Partial results over total failure**
4. **Stable contracts over clever abstractions**
5. **Explicit provider provenance**
6. **No telemetry by default**

## License

MIT © Divyanshu. See [LICENSE](LICENSE).

If SearchForge makes your RAG stack simpler, consider starring the repository and sharing a real integration in [Discussions](https://github.com/divyanshu-iitian/SearchForge/discussions).
