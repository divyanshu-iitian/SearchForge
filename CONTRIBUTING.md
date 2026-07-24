# Contributing to SearchForge

SearchForge welcomes focused contributions that make web evidence more reliable for LLM and RAG applications.

## Before opening a pull request

1. Open an issue for a new provider or public API change.
2. Keep provider-specific behavior inside `src/providers`.
   Keep reader-specific behavior inside `src/readers`.
3. Never add a default dependency on a public community SearXNG instance.
4. Preserve the response schema unless the change is explicitly versioned.
5. Add deterministic tests; CI must not depend on live search services.

## Local verification

```bash
npm ci
npm run check
npm test
npm run build
npm pack --dry-run
```

## Provider checklist

- Official or clearly documented endpoint
- Terms permit programmatic use
- Timeout and errors are normalized
- Secrets are sent only in headers
- Raw provider bodies are not logged
- Result title, URL, snippet, and date are mapped
- Capability category, access tier, description, and health probe are declared
- Tests mock every external request

By contributing, you agree that your work is released under the MIT license.
