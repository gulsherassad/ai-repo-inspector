#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { reviewRepository } from "./core.js";

const server = new McpServer({ name: "repository-inspector", version: "2.0.0" });

// NOTE: `validationCommands` is intentionally NOT part of the MCP input
// schema. Over MCP the caller may be an AI agent acting on untrusted input,
// and validationCommands ultimately runs through a shell (src/validation.ts,
// exec()). Exposing it here would hand arbitrary command execution across an
// untrusted trust boundary. MCP is inspect-and-report only; the CLI (a
// trusted developer entry point) is the only caller allowed to run
// validation commands.
const reviewRepositoryInputShape = {
  repositoryPath: z.string().describe("Repository path to inspect."),
  baseRef: z.string().optional(),
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
    });
    return { content: [{ type: "text", text: report }] };
  },
);

await server.connect(new StdioServerTransport());