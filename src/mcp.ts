#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createSearchForgeFromEnv } from "./config.js";

const searchForge = createSearchForgeFromEnv();
const server = new McpServer({
  name: "searchforge",
  version: "0.2.0",
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
      category: z.enum(["web", "code", "academic", "community"]).default("web"),
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
      category: input.category,
      ...(input.providers ? { providers: input.providers } : {}),
    });
    return {
      content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      structuredContent: response as unknown as Record<string, unknown>,
    };
  },
);

server.registerTool(
  "read_url",
  {
    title: "Read a web page",
    description: "Turn a public HTTP or HTTPS page into clean, LLM-ready Markdown without an API key.",
    inputSchema: { url: z.string().url().max(2048) },
  },
  async ({ url }) => {
    const response = await searchForge.read(url);
    return {
      content: [{ type: "text", text: response.content }],
      structuredContent: response as unknown as Record<string, unknown>,
    };
  },
);

server.registerTool(
  "search_status",
  {
    title: "Check SearchForge capabilities",
    description: "Probe configured search providers and the URL reader, returning latency and failures.",
    inputSchema: {},
  },
  async () => {
    const response = await searchForge.doctor();
    return {
      content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      structuredContent: response as unknown as Record<string, unknown>,
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
