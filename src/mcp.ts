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
    description:
      "Search public sources and return ranked, deduplicated, citation-ready results. Use this for discovery across the web, GitHub repositories, academic works, or Hacker News; use read_url instead when a specific page URL is already known. This read-only operation may contact the selected third-party providers, so availability and rate limits depend on them.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    inputSchema: {
      query: z.string().min(1).max(500).describe("Natural-language search query, from 1 to 500 characters."),
      limit: z.number().int().min(1).max(20).default(8).describe("Maximum number of results to return (1-20)."),
      language: z.string().default("en").describe("Preferred result language as a short language code, such as en or hi."),
      freshness: z
        .enum(["day", "week", "month", "year"])
        .default("month")
        .describe("Preferred age window for results; providers that cannot filter by date may ignore it."),
      safeSearch: z
        .enum(["off", "moderate", "strict"])
        .default("moderate")
        .describe("Requested safe-search level; enforcement depends on the selected provider."),
      category: z
        .enum(["auto", "web", "code", "academic", "community"])
        .default("auto")
        .describe("Source family. Auto infers useful source families from the query; explicit values restrict routing."),
      providers: z
        .array(z.string())
        .optional()
        .describe("Optional provider IDs to restrict routing; omit to let SearchForge choose configured providers."),
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
    description:
      "Fetch one known public HTTP or HTTPS page and return clean, LLM-ready Markdown. Use this after web_search or when the exact URL is already known; do not use it to discover pages or access authenticated/private content. This read-only operation sends the URL to the configured reader service and can fail when the site blocks retrieval.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    inputSchema: {
      url: z.string().url().max(2048).describe("Absolute public HTTP or HTTPS URL to fetch, up to 2,048 characters."),
    },
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
    description:
      "Probe every configured search provider and the URL reader, returning availability, latency, and failure details. Use this to diagnose SearchForge setup or provider outages, not to search for content. The probe is read-only but makes small external test requests that may count against provider rate limits.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
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
