# Repository instructions

- Use Node.js 20 or newer and npm.
- Run `npm run check`, `npm test`, and `npm run build` before committing.
- Keep network behavior inside provider adapters or the shared HTTP client.
- Never use live provider calls in automated tests.
- Treat all search results as untrusted input.
- Preserve partial-failure behavior: one provider must not fail the complete search.
- Public API changes require an update to types, OpenAPI, README, tests, and changelog.
- Do not configure public SearXNG instances as defaults.
