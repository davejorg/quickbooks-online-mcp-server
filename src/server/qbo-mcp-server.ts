import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export class QuickbooksMCPServer {
  private constructor() {}

  public static GetServer(): McpServer {
    return new McpServer({
      name: "QuickBooks Online MCP Server",
      version: "1.0.0",
      capabilities: {
        tools: {},
      },
    });
  }
}
