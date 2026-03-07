import type { ManagedEntityDetail, ManagedEntitySummary } from "@sandboxd/core";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, expect, test, vi } from "vitest";
import { createSandboxdMcpServer } from "./index";

const connectedClients = new Set<Client>();
const connectedServers = new Set<ReturnType<typeof createSandboxdMcpServer>>();

function createEntityDetail(unitName = "lab-api.service"): ManagedEntityDetail {
  return {
    unitName,
    kind: "sandbox-service",
    origin: "sandboxd",
    unitType: "service",
    state: "active",
    subState: "running",
    loadState: "loaded",
    slice: "sandboxd.slice",
    labels: {},
    capabilities: {
      canInspect: true,
      canStart: false,
      canStop: true,
      canRestart: true,
    },
    resourceControls: {},
    sandboxing: {},
    status: {
      activeState: "active",
      subState: "running",
      loadState: "loaded",
    },
  };
}

afterEach(async () => {
  await Promise.all([...connectedClients].map((client) => client.close()));
  await Promise.all([...connectedServers].map((server) => server.close()));
  connectedClients.clear();
  connectedServers.clear();
});

test("registers all v1 tools", async () => {
  const server = createSandboxdMcpServer({
    listManagedEntities: vi.fn().mockResolvedValue([] as ManagedEntitySummary[]),
    inspectManagedEntity: vi.fn().mockResolvedValue(createEntityDetail()),
    startManagedEntity: vi.fn().mockResolvedValue(createEntityDetail()),
    stopManagedEntity: vi.fn().mockResolvedValue(createEntityDetail()),
    restartManagedEntity: vi.fn().mockResolvedValue(createEntityDetail()),
    dangerouslyAdoptManagedEntity: vi.fn().mockResolvedValue(createEntityDetail("docker.service")),
    createSandboxService: vi.fn().mockResolvedValue(createEntityDetail("lab-worker.service")),
  });
  const client = new Client({
    name: "sandboxd-mcp-test-client",
    version: "0.1.0",
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  connectedServers.add(server);
  connectedClients.add(client);
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const result = await client.listTools();
  const toolNames = result.tools.map((tool) => tool.name).sort();

  expect(toolNames).toEqual([
    "create_sandboxed_service",
    "dangerously_adopt_service",
    "inspect",
    "list",
    "restart",
    "start",
    "stop",
  ]);
});

test("invokes injected handlers and returns JSON text payloads", async () => {
  const inspectManagedEntity = vi.fn().mockResolvedValue(createEntityDetail());
  const server = createSandboxdMcpServer({
    listManagedEntities: vi.fn().mockResolvedValue([] as ManagedEntitySummary[]),
    inspectManagedEntity,
    startManagedEntity: vi.fn().mockResolvedValue(createEntityDetail()),
    stopManagedEntity: vi.fn().mockResolvedValue(createEntityDetail()),
    restartManagedEntity: vi.fn().mockResolvedValue(createEntityDetail()),
    dangerouslyAdoptManagedEntity: vi.fn().mockResolvedValue(createEntityDetail("docker.service")),
    createSandboxService: vi.fn().mockResolvedValue(createEntityDetail("lab-worker.service")),
  });
  const client = new Client({
    name: "sandboxd-mcp-test-client",
    version: "0.1.0",
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  connectedServers.add(server);
  connectedClients.add(client);
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const result = await client.callTool({
    name: "inspect",
    arguments: {
      unitName: "lab-api.service",
    },
  });
  const content = result.content as Array<{ type: string; text?: string }>;

  expect(inspectManagedEntity).toHaveBeenCalledWith("lab-api.service");
  expect(result.isError).not.toBe(true);
  expect(content[0]).toMatchObject({
    type: "text",
  });
  if (content[0]?.type !== "text" || typeof content[0].text !== "string") {
    throw new TypeError("Expected a text MCP response");
  }

  await expect(JSON.parse(content[0].text)).toMatchObject({
    unitName: "lab-api.service",
  });
});
