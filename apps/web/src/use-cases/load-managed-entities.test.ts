import { expect, test, vi } from "vitest";
import type { ManagedEntitiesClientPort } from "../ports/managed-entities-client-port";
import { createLoadManagedEntities } from "./load-managed-entities";

test("delegates managed entity loading to the client port", async () => {
  const client: ManagedEntitiesClientPort = {
    loadManagedEntities: vi.fn().mockResolvedValue([
      {
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
      },
    ]),
    loadManagedEntity: vi.fn(),
    startManagedEntity: vi.fn(),
    stopManagedEntity: vi.fn(),
    restartManagedEntity: vi.fn(),
    createSandboxService: vi.fn(),
    updateSandboxService: vi.fn(),
    deleteSandboxService: vi.fn(),
  };

  const loadManagedEntities = createLoadManagedEntities({ client });

  await expect(loadManagedEntities()).resolves.toMatchObject([{ unitName: "lab-api.service" }]);
  expect(client.loadManagedEntities).toHaveBeenCalledTimes(1);
});
