import { afterEach, expect, test, vi } from "vitest";
import { createManagedEntitiesHttpClient } from "./managed-entities-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("loads and parses managed entity summaries from the API", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          kind: "systemd-unit",
          origin: "external",
          unitName: "docker.service",
          unitType: "service",
          state: "active",
          labels: {},
          capabilities: {
            canInspect: true,
            canStart: false,
            canStop: false,
            canRestart: false,
          },
        },
      ],
    }),
  );

  const client = createManagedEntitiesHttpClient();

  await expect(client.loadManagedEntities()).resolves.toMatchObject([
    { unitName: "docker.service" },
  ]);
});

test("loads and parses a managed entity detail from the API", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        kind: "sandbox-service",
        origin: "sandboxd",
        unitName: "lab-api.service",
        unitType: "service",
        state: "active",
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
      }),
    }),
  );

  const client = createManagedEntitiesHttpClient();

  await expect(client.loadManagedEntity("lab-api.service")).resolves.toMatchObject({
    unitName: "lab-api.service",
    status: { subState: "running" },
  });
});

test("surfaces API failures", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }),
  );

  const client = createManagedEntitiesHttpClient();

  await expect(client.loadManagedEntities()).rejects.toThrow(/503/);
});
