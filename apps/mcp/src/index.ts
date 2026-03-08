import { type ControlPlane } from "@sandboxd/control-plane";
import {
  createSandboxServiceInputSchema,
  dangerousAdoptManagedEntityInputSchema,
  getSupportedAdvancedPropertySpec,
  supportedAdvancedPropertyKeySchema,
  supportedAdvancedPropertySpecs,
} from "@sandboxd/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export interface SandboxdMcpContext {
  createSandboxService: ControlPlane["createSandboxService"];
  deleteSandboxService: ControlPlane["deleteSandboxService"];
  dangerouslyAdoptManagedEntity: ControlPlane["dangerouslyAdoptManagedEntity"];
  inspectManagedEntity: ControlPlane["inspectManagedEntity"];
  listManagedEntities: ControlPlane["listManagedEntities"];
  restartManagedEntity: ControlPlane["restartManagedEntity"];
  startManagedEntity: ControlPlane["startManagedEntity"];
  stopManagedEntity: ControlPlane["stopManagedEntity"];
  updateSandboxService: ControlPlane["updateSandboxService"];
}

export function createSandboxdMcpServer(context: SandboxdMcpContext) {
  const server = new McpServer({
    name: "sandboxd-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "list_supported_systemd_properties",
    {
      description:
        "List the first-batch advanced systemd properties exposed by sandboxd for structured editing.",
    },
    async () => createJsonToolResult(supportedAdvancedPropertySpecs),
  );

  server.registerTool(
    "describe_systemd_property",
    {
      description: "Describe one advanced systemd property supported by sandboxd.",
      inputSchema: {
        key: supportedAdvancedPropertyKeySchema,
      },
    },
    async ({ key }) => createJsonToolResult(getSupportedAdvancedPropertySpec(key)),
  );

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

  server.registerTool(
    "update_sandboxed_service",
    {
      description: "Update an existing sandboxd-managed sandboxed service.",
      inputSchema: {
        unitName: z.string().min(1),
        ...createSandboxServiceInputSchema.shape,
      },
    },
    async ({ unitName, ...input }) =>
      createJsonToolResult(await context.updateSandboxService(unitName, input)),
  );

  server.registerTool(
    "delete_sandboxed_service",
    {
      description: "Delete an existing sandboxd-managed sandboxed service.",
      inputSchema: {
        unitName: z.string().min(1),
      },
    },
    async ({ unitName }) => {
      await context.deleteSandboxService(unitName);
      return createJsonToolResult({ deleted: true, unitName });
    },
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
