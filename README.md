<div align="center">

# SearchForge

### Free search and web reading for every LLM, agent, and RAG pipeline.

[![CI](https://github.com/divyanshu-iitian/SearchForge/actions/workflows/ci.yml/badge.svg)](https://github.com/divyanshu-iitian/SearchForge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-22c55e.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=nodedotjs&logoColor=white)](package.json)
[![MCP](https://img.shields.io/badge/MCP-3_tools-8b5cf6)](https://modelcontextprotocol.io)

**One local gateway. Four search capabilities. Clean Markdown. REST, MCP, CLI, and TypeScript.**

[Quick start](#quick-start) · [Free tools](#free-tools) · [MCP](#mcp) · [API](#rest-api) · [Design](#how-it-works)

</div>

---

SearchForge gives agents a small, predictable retrieval layer without forcing every project to integrate a paid search vendor. It routes a query to the right source, isolates provider failures, deduplicates URLs, fuses rankings, and can turn a public page into LLM-ready Markdown.

It does **not** generate answers, hide citations, scrape public SearXNG instances, or send telemetry.

## What you get

| Capability | Default source | Cost / credentials |
|---|---|---|
| `web` | Wikipedia; optional private SearXNG | No key / self-hosted |
| `code` | GitHub repository search | No key; token optional |
| `academic` | Crossref works and DOI metadata | No key |
| `community` | Hacker News via Algolia | No key, community service |
| `read_url` | Jina Reader | No key, currently rate-limited |

SearchForge starts with all no-key adapters enabled. A GitHub token only raises the public API quota, and Brave remains an optional keyed backend. Broad, independent web metasearch is provided by the included SearXNG stack.

## Quick start

### Zero-key local CLI

```bash
git clone https://github.com/divyanshu-iitian/SearchForge.git
cd SearchForge
npm install
npm run build

node dist/cli.js search "open source agent frameworks" --category code
node dist/cli.js search "retrieval augmented generation" --category academic
node dist/cli.js search "local LLM tooling" --category community
node dist/cli.js read "https://example.com"
node dist/cli.js doctor
```

### Full web search with private SearXNG

```bash
docker compose up --build
```

```bash
curl -s http://localhost:3000/v1/search \
  -H "content-type: application/json" \
  -d '{"query":"open source vector databases","category":"web","limit":5}'
```

This starts SearchForge on port `3000` and a private, JSON-enabled SearXNG on port `8080`. Before exposing the stack, change the SearXNG secret, set `SEARCHFORGE_API_KEY`, and terminate TLS at a trusted proxy.

## Free tools

### Search by capability

```bash
searchforge search "browser agent" --category code
searchforge search "semantic reranking" --category academic --json
searchforge search "Show HN search engine" --category community
```

Categories prevent irrelevant providers from being queried. An explicit `providers` list overrides category routing, which is useful for evaluations.

### Read a URL as Markdown

```bash
searchforge read "https://example.com/article"
```

`read_url` accepts public HTTP(S) URLs only. Credentials, localhost, private IP literals, and non-web protocols are rejected. Responses are size-bounded, timed out, and cached.

### Diagnose the whole retrieval path

```bash
searchforge doctor
```

Doctor performs real, bounded probes and reports each provider's access tier, capability, latency, and error. A failed source produces `degraded`, not a misleading all-or-nothing status.

## MCP

SearchForge exposes three stdio tools:

- `web_search` — routed, citation-ready structured search
- `read_url` — clean Markdown from a public URL
- `search_status` — live capability and latency report

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

The search and status tools return MCP structured content as well as readable text.

## REST API

### Search

```http
POST /v1/search
Content-Type: application/json

{
  "query": "open source reranking models",
  "category": "academic",
  "limit": 8,
  "language": "en",
  "freshness": "month",
  "safeSearch": "moderate"
}
```

```json
{
  "schemaVersion": "1.0",
  "query": "open source reranking models",
  "category": "academic",
  "results": [
    {
      "title": "Example work",
      "url": "https://doi.org/10.0000/example",
      "snippet": "Authors · Publisher · journal-article",
      "source": "crossref",
      "sources": ["crossref"],
      "score": 0.016393
    }
  ],
  "providers": [
    {
      "provider": "crossref",
      "ok": true,
      "latencyMs": 241,
      "resultCount": 8
    }
  ],
  "tookMs": 243,
  "cached": false
}
```

### Read

```http
POST /v1/read
Content-Type: application/json

{"url":"https://example.com/article"}
```

Other endpoints:

```text
GET /healthz       Process liveness
GET /v1/providers  Configured capabilities and access tiers
GET /v1/doctor     Live dependency health
```

See the full [OpenAPI contract](openapi.yaml).

## TypeScript SDK

```ts
import {
  CrossrefProvider,
  GithubProvider,
  JinaReader,
  SearchForge,
} from "searchforge-rag";

const forge = new SearchForge({
  providers: [new GithubProvider(), new CrossrefProvider()],
  reader: new JinaReader(),
  timeoutMs: 8_000,
});

const evidence = await forge.search({
  query: "agentic retrieval",
  category: "academic",
  limit: 10,
});

const page = await forge.read("https://example.com/research");
```

Until an npm release is published:

```bash
npm install github:divyanshu-iitian/SearchForge
```

## Provider details

| Provider | Capability | Access | Enabled |
|---|---|---|---|
| [SearXNG](https://docs.searxng.org/) | Web | Self-hosted, no vendor fee | `SEARCHFORGE_SEARXNG_URL` |
| Wikipedia | Web knowledge fallback | No key | Always |
| [GitHub](https://docs.github.com/rest/search/search) | Code repositories | No key; 60 unauthenticated REST requests/hour, search has tighter limits | Always |
| [Crossref](https://www.crossref.org/documentation/retrieve-metadata/rest-api/) | Academic metadata | No key; `mailto` recommended | Always |
| [HN Algolia](https://hn.algolia.com/api) | Community | No key; community-operated availability | Always |
| [Jina Reader](https://jina.ai/reader/) | URL to Markdown | No key; documented no-key quota currently 20 RPM | Always |
| [Brave Search](https://brave.com/search/api/) | Web | API key | `BRAVE_SEARCH_API_KEY` |

SearchForge intentionally does not configure public SearXNG instances. They often disable JSON or limit automated traffic; the Docker stack is the stable free path.

## How it works

```text
Agent / RAG / MCP client
           |
      validate + route
           |
  +--------+---------+-----------+
  |        |         |           |
 web      code    academic   community       read_url
  |        |         |           |              |
SearXNG  GitHub   Crossref   Hacker News    Jina Reader
Wikipedia
  +--------+---------+-----------+
           |
 normalize -> canonicalize -> deduplicate -> reciprocal-rank fusion
           |
 versioned evidence + provenance + per-source health
```

Each idempotent provider call has its own abortable timeout. One outage cannot erase healthy results. Tracking parameters are removed before deduplication, and every contributing provider remains in `sources`.

This capability-first design is inspired by [Agent Reach](https://github.com/Panniantong/Agent-Reach). Agent Reach helps an agent operate many upstream tools directly; SearchForge complements that approach with one stable, embeddable retrieval API for RAG applications.

## Configuration

| Variable | Default | Purpose |
|---|---:|---|
| `SEARCHFORGE_SEARXNG_URL` | unset | Private SearXNG base URL |
| `GITHUB_TOKEN` | unset | Optional GitHub quota increase |
| `CROSSREF_MAILTO` | unset | Crossref polite-pool identity |
| `BRAVE_SEARCH_API_KEY` | unset | Optional Brave backend |
| `SEARCHFORGE_API_KEY` | unset | REST bearer or `x-api-key` |
| `SEARCHFORGE_PORT` | `3000` | REST port |
| `SEARCHFORGE_HOST` | `127.0.0.1` | Bind address |
| `SEARCHFORGE_TIMEOUT_MS` | `8000` | Per-dependency timeout |
| `SEARCHFORGE_CACHE_TTL_MS` | `300000` | In-memory cache TTL |
| `SEARCHFORGE_CACHE_MAX_ENTRIES` | `500` | Cache entry bound |
| `SEARCHFORGE_RATE_LIMIT` | `60` | Requests/client/minute |

## Production boundary

- Set an API key before binding to a public interface.
- Search results and page content are untrusted input; delimit them and apply prompt-injection defenses.
- The built-in cache and rate limiter are process-local. Use shared infrastructure for multiple replicas.
- Provider bodies and credentials are excluded from surfaced errors.
- `healthz` proves the process is alive; `/v1/doctor` checks dependencies.

See [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [CHANGELOG.md](CHANGELOG.md).

## Principles

1. Evidence over generated answers
2. Free and self-hosted paths before vendor lock-in
3. Partial results over total failure
4. Honest capability and quota reporting
5. Stable contracts and explicit provenance
6. No telemetry by default

## License

MIT © Divyanshu.

If SearchForge helps your agent, star the repository and share your integration in [Discussions](https://github.com/divyanshu-iitian/SearchForge/discussions).
