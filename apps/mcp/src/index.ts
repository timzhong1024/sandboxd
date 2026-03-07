import { type ControlPlane } from "@sandboxd/control-plane";
import {
  createSandboxServiceInputSchema,
  dangerousAdoptManagedEntityInputSchema,
} from "@sandboxd/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export interface SandboxdMcpContext {
  createSandboxService: ControlPlane["createSandboxService"];
  dangerouslyAdoptManagedEntity: ControlPlane["dangerouslyAdoptManagedEntity"];
  inspectManagedEntity: ControlPlane["inspectManagedEntity"];
  listManagedEntities: ControlPlane["listManagedEntities"];
  restartManagedEntity: ControlPlane["restartManagedEntity"];
  startManagedEntity: ControlPlane["startManagedEntity"];
  stopManagedEntity: ControlPlane["stopManagedEntity"];
}

export function createSandboxdMcpServer(context: SandboxdMcpContext) {
  const server = new McpServer({
    name: "sandboxd-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "list",
    {
      description: "List sandboxd managed entities and observed external systemd units.",
    },
    async () => createJsonToolResult(await context.listManagedEntities()),
  );

  server.registerTool(
    "inspect",
    {
      description: "Inspect a managed entity by unit name.",
      inputSchema: {
        unitName: z.string().min(1),
      },
    },
    async ({ unitName }) => createJsonToolResult(await context.inspectManagedEntity(unitName)),
  );

  server.registerTool(
    "start",
    {
      description: "Start a sandboxd-managed entity.",
      inputSchema: {
        unitName: z.string().min(1),
      },
    },
    async ({ unitName }) => createJsonToolResult(await context.startManagedEntity(unitName)),
  );

  server.registerTool(
    "stop",
    {
      description: "Stop a sandboxd-managed entity.",
      inputSchema: {
        unitName: z.string().min(1),
      },
    },
    async ({ unitName }) => createJsonToolResult(await context.stopManagedEntity(unitName)),
  );

  server.registerTool(
    "restart",
    {
      description: "Restart a sandboxd-managed entity.",
      inputSchema: {
        unitName: z.string().min(1),
      },
    },
    async ({ unitName }) => createJsonToolResult(await context.restartManagedEntity(unitName)),
  );

  server.registerTool(
    "dangerously_adopt_service",
    {
      description: "Dangerously mark an existing systemd service as sandboxd-managed.",
      inputSchema: {
        unitName: z.string().min(1),
        ...dangerousAdoptManagedEntityInputSchema.shape,
      },
    },
    async ({ unitName, ...input }) =>
      createJsonToolResult(await context.dangerouslyAdoptManagedEntity(unitName, input)),
  );

  server.registerTool(
    "create_sandboxed_service",
    {
      description: "Create a new sandboxd-managed sandboxed service.",
      inputSchema: createSandboxServiceInputSchema,
    },
    async (input) => createJsonToolResult(await context.createSandboxService(input)),
  );

  return server;
}

function createJsonToolResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}
