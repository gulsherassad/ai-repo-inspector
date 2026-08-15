#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { reviewRepository } from "./core.js";

const server = new McpServer({ name: "repository-inspector", version: "2.0.0" });

const reviewRepositoryInputShape = {
  repositoryPath: z.string().describe("Repository path to inspect."),
  baseRef: z.string().optional(),
  validationCommands: z.array(z.string()).optional(),
};
type ReviewRepositoryInput = z.infer<z.ZodObject<typeof reviewRepositoryInputShape>>;

server.tool(
  "review_repository",
  "Inspects a Git repository and returns a review report.",
  reviewRepositoryInputShape,
  async (input: ReviewRepositoryInput) => {
    const report = await reviewRepository({
      repositoryPath: input.repositoryPath,
      baseRef: input.baseRef,
      validationCommands: input.validationCommands,
    });
    return { content: [{ type: "text", text: report }] };
  },
);

await server.connect(new StdioServerTransport());