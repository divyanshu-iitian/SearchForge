# Security policy

## Supported versions

Security fixes are applied to the latest release.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository. Do not open a public issue for credentials, authentication bypasses, SSRF, denial-of-service paths, or dependency vulnerabilities.

## Trust boundary

Search results are untrusted internet content. SearchForge normalizes metadata but does not claim that titles, snippets, URLs, or dates are safe or true. RAG applications must delimit retrieved text, preserve citations, and defend against prompt injection.

SearchForge does not execute returned content, call an LLM, or collect telemetry. The optional `read_url` capability sends the requested public URL to Jina Reader and returns its Markdown response. Do not use it for private, authenticated, or secret-bearing URLs.

`read_url` rejects credentials, non-HTTP protocols, localhost names, and private IP literals. The content is size-bounded and treated as untrusted. Deployments with stricter requirements should also enforce an outbound hostname allowlist at the network boundary.

For public deployments:

- set `SEARCHFORGE_API_KEY`;
- use TLS at a reverse proxy;
- keep SearXNG off the public network;
- replace the example SearXNG secret;
- apply network egress controls appropriate to your providers;
- use a distributed rate limiter when running multiple replicas.
- review third-party provider privacy and retention policies before sending sensitive queries.
