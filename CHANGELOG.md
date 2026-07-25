# Changelog

All notable changes are documented here.

## Unreleased

### Added

- Intent-aware `auto` routing across web, code, academic, and community sources
- Provider-text normalization that decodes entities and removes embedded HTML
- One-command GitHub CLI and MCP quick starts
- Crawlable project website with structured software metadata
- `llms.txt`, sitemap, robots policy, and citation metadata
- Official MCP Registry namespace metadata for a future npm release
- MCP-specific OCI image target and secret-free GitHub OIDC registry publishing

### Changed

- Docker Compose now targets the REST runtime explicitly while Glama and registry builds retain the MCP stdio target
- README and package metadata now describe SearchForge with exact search terms
- README links to the active official MCP Registry entry and published OCI image

## 0.2.0 - 2026-07-24

### Added

- Capability routing for web, code, academic, and community search
- No-key GitHub repository, Crossref academic, and Hacker News adapters
- Jina Reader integration through REST, MCP, CLI, and TypeScript
- Live `doctor` diagnostics with access tiers, latency, and partial failures
- MCP `read_url` and `search_status` tools
- Provider metadata discovery and honest quota documentation

### Changed

- Provider timeouts now abort in-flight requests
- Search responses include the selected capability category
- README and OpenAPI contract cover all v0.2 surfaces

## 0.1.0 - 2026-07-23

### Added

- SearXNG, Brave Search, and Wikipedia provider adapters
- Concurrent provider execution with independent timeouts
- Canonical URL deduplication and Reciprocal Rank Fusion
- Versioned search request and response schema
- REST server with optional authentication, rate limiting, and request IDs
- MCP stdio `web_search` tool with structured output
- CLI and TypeScript SDK
- Bounded in-memory TTL cache
- Docker Compose stack with a JSON-enabled SearXNG instance
- OpenAPI contract, deterministic tests, and multi-version CI
