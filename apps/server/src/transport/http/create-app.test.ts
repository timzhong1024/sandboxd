import { once } from "node:events";
import { afterEach, expect, test, vi } from "vitest";
import { createApp } from "./create-app";

const servers = new Set<ReturnType<typeof createApp>>();

function createEntityDetail(unitName = "lab-api.service") {
  return {
    unitName,
    kind: "sandbox-service" as const,
    origin: "sandboxd" as const,
    unitType: "service",
    state: "active",
    subState: "running",
    loadState: "loaded",
    description: "Sandboxd managed lab API",
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

function createServerForTest() {
  return createApp({
    listManagedEntities: vi.fn().mockResolvedValue([createEntityDetail()]),
    inspectManagedEntity: vi.fn().mockResolvedValue(createEntityDetail()),
    startManagedEntity: vi.fn().mockResolvedValue(createEntityDetail()),
    stopManagedEntity: vi.fn().mockResolvedValue(createEntityDetail("lab-api.service")),
    restartManagedEntity: vi.fn().mockResolvedValue(createEntityDetail()),
    createSandboxService: vi.fn().mockResolvedValue(createEntityDetail("lab-worker.service")),
  });
}

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    ),
  );
  servers.clear();
});

test("returns entity summaries through the API", async () => {
  const server = createServerForTest();
  servers.add(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new TypeError("Expected an ephemeral TCP port");
  }

  const response = await fetch(`http://127.0.0.1:${address.port}/api/entities`);

  expect(response.ok).toBe(true);
  expect(await response.json()).toMatchObject([{ unitName: "lab-api.service" }]);
});

test("returns an entity detail through the API", async () => {
  const server = createServerForTest();
  servers.add(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new TypeError("Expected an ephemeral TCP port");
  }

  const response = await fetch(`http://127.0.0.1:${address.port}/api/entities/lab-api.service`);

  expect(response.ok).toBe(true);
  expect(await response.json()).toMatchObject({
    unitName: "lab-api.service",
    status: { subState: "running" },
  });
});

test("creates sandbox services through the API", async () => {
  const server = createServerForTest();
  servers.add(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new TypeError("Expected an ephemeral TCP port");
  }

  const response = await fetch(`http://127.0.0.1:${address.port}/api/sandbox-services`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: "lab-worker",
      execStart: "/usr/bin/python worker.py",
    }),
  });

  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({ unitName: "lab-worker.service" });
});

test("returns healthz status", async () => {
  const server = createServerForTest();
  servers.add(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new TypeError("Expected an ephemeral TCP port");
  }

  const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);

  expect(response.ok).toBe(true);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});
