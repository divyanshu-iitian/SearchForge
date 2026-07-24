FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci --ignore-scripts
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
USER node
COPY --chown=node:node --from=build /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "dist/cli.js", "serve", "--host", "0.0.0.0"]

FROM node:22-alpine AS mcp
LABEL org.opencontainers.image.title="SearchForge MCP Server"
LABEL org.opencontainers.image.description="Open-source web search for LLMs, AI agents, and RAG"
LABEL org.opencontainers.image.source="https://github.com/divyanshu-iitian/SearchForge"
LABEL org.opencontainers.image.licenses="MIT"
LABEL io.modelcontextprotocol.server.name="io.github.divyanshu-iitian/searchforge"
ENV NODE_ENV=production
WORKDIR /app
USER node
COPY --chown=node:node --from=build /app/package.json /app/package-lock.json ./
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
CMD ["node", "dist/mcp.js"]
