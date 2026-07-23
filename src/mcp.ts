#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createSearchForgeFromEnv } from "./config.js";

const searchForge = createSearchForgeFromEnv();
const server = new McpServer({
  name: "searchforge",
  version: "0.1.0",
});

server.registerTool(
  "web_search",
  {
    title: "Search the web",
    description: "Search current web sources and return citation-ready URLs and snippets.",
    inputSchema: {
      query: z.string().min(1).max(500).describe("The web search query"),
      limit: z.number().int().min(1).max(20).default(8),
      language: z.string().default("en"),
      freshness: z.enum(["day", "week", "month", "year"]).default("month"),
      safeSearch: z.enum(["off", "moderate", "strict"]).default("moderate"),
      providers: z.array(z.string()).optional(),
    },
  },
  async (input) => {
    const response = await searchForge.search({
      query: input.query,
      limit: input.limit,
      language: input.language,
      freshness: input.freshness,
      safeSearch: input.safeSearch,
      ...(input.providers ? { providers: input.providers } : {}),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      structuredContent: response as unknown as Record<string, unknown>,
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
