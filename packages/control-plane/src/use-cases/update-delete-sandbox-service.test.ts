import { expect, test, vi } from "vitest";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { ManagedEntityConflictError } from "./managed-entity-errors";
import { createDeleteSandboxService } from "./delete-sandbox-service";
import { createUpdateSandboxService } from "./update-sandbox-service";

function createMetadataSource(): ManagedEntityMetadataSourcePort {
  return {
    createFallbackSandboxService: vi.fn(),
    deleteFallbackSandboxService: vi.fn().mockResolvedValue(true),
    deleteManagedEntityMetadata: vi.fn().mockResolvedValue(undefined),
    dangerouslyAdoptFallbackEntity: vi.fn().mockResolvedValue(null),
    dangerouslyAdoptManagedEntity: vi.fn(),
    getFallbackEntityDetail: vi.fn().mockResolvedValue(null),
    getManagedEntityMetadata: vi.fn().mockResolvedValue({
      unitName: "lab-api.service",
      sandboxProfile: "baseline",
      resourceControls: {},
      sandboxing: {},
      slice: "sandboxd.slice",
    }),
    listFallbackEntitySummaries: vi.fn().mockResolvedValue([]),
    listManagedEntityMetadata: vi.fn().mockResolvedValue([]),
    saveManagedEntityMetadata: vi.fn(),
    updateFallbackEntityState: vi.fn().mockResolvedValue(null),
    updateFallbackSandboxService: vi.fn().mockResolvedValue({
      kind: "sandbox-service",
      origin: "sandboxd",
      unitName: "lab-api.service",
      unitType: "service",
      state: "inactive",
      subState: "dead",
      loadState: "loaded",
      labels: {},
      capabilities: {
        canInspect: true,
        canStart: true,
        canStop: false,
        canRestart: false,
      },
      resourceControls: {},
      sandboxing: {},
      status: {
        activeState: "inactive",
        subState: "dead",
        loadState: "loaded",
      },
    }),
    updateManagedEntityMetadata: vi.fn().mockResolvedValue({
      unitName: "lab-api.service",
      sandboxProfile: "baseline",
      resourceControls: {},
      sandboxing: {},
      slice: "sandboxd.slice",
    }),
  };
}

function createRuntime(overrides: Partial<SystemdRuntimePort> = {}): SystemdRuntimePort {
  return {
    createSandboxService: vi.fn().mockResolvedValue(undefined),
    deleteSandboxService: vi.fn().mockResolvedValue(undefined),
    getUnit: vi.fn().mockResolvedValue({
      unitName: "lab-api.service",
      loadState: "loaded",
      activeState: "inactive",
      subState: "dead",
      description: "Sandboxd managed lab API",
      slice: "sandboxd.slice",
      resourceControls: {},
      sandboxing: {},
    }),
    listUnits: vi.fn().mockResolvedValue([]),
    reloadSystemd: vi.fn().mockResolvedValue(undefined),
    restartUnit: vi.fn().mockResolvedValue(undefined),
    startUnit: vi.fn().mockResolvedValue(undefined),
    stopUnit: vi.fn().mockResolvedValue(undefined),
    updateSandboxService: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

test("updates sandbox services through runtime and metadata", async () => {
  const metadataSource = createMetadataSource();
  const systemdRuntime = createRuntime();
  const updateSandboxService = createUpdateSandboxService({
    metadataSource,
    systemdRuntime,
  });

  await expect(
    updateSandboxService("lab-api.service", {
      name: "lab-api",
      execStart: "/usr/bin/node server.js",
      sandboxProfile: "baseline",
    }),
  ).resolves.toMatchObject({
    unitName: "lab-api.service",
  });

  expect(systemdRuntime.updateSandboxService).toHaveBeenCalledWith(
    "lab-api.service",
    expect.objectContaining({
      execStart: "/usr/bin/node server.js",
    }),
  );
  expect(metadataSource.updateManagedEntityMetadata).toHaveBeenCalledWith(
    "lab-api.service",
    expect.objectContaining({
      execStart: "/usr/bin/node server.js",
    }),
  );
  expect(systemdRuntime.restartUnit).not.toHaveBeenCalled();
});

test("restarts active sandbox services after updating their unit file", async () => {
  const metadataSource = createMetadataSource();
  const systemdRuntime = createRuntime({
    getUnit: vi
      .fn()
      .mockResolvedValueOnce({
        unitName: "lab-api.service",
        loadState: "loaded",
        activeState: "active",
        subState: "running",
        description: "Sandboxd managed lab API",
        slice: "sandboxd.slice",
        resourceControls: {},
        sandboxing: {},
      })
      .mockResolvedValueOnce({
        unitName: "lab-api.service",
        loadState: "loaded",
        activeState: "active",
        subState: "running",
        description: "Sandboxd managed lab API",
        slice: "sandboxd.slice",
        resourceControls: {},
        sandboxing: {},
      }),
  });
  const updateSandboxService = createUpdateSandboxService({
    metadataSource,
    systemdRuntime,
  });

  await expect(
    updateSandboxService("lab-api.service", {
      name: "lab-api",
      execStart: "/usr/bin/node server.js",
      sandboxProfile: "baseline",
    }),
  ).resolves.toMatchObject({
    unitName: "lab-api.service",
    state: "active",
  });

  expect(systemdRuntime.restartUnit).toHaveBeenCalledWith("lab-api.service");
});

test("rejects updates for inspect-only entities", async () => {
  const metadataSource = createMetadataSource();
  const systemdRuntime = createRuntime({
    getUnit: vi.fn().mockResolvedValue({
      unitName: "lab-api.service",
      loadState: "loaded",
      activeState: "inactive",
      subState: "dead",
      description: "Sandboxd managed lab API",
      slice: "sandboxd.slice",
      resourceControls: {},
      sandboxing: {},
      unknownSystemdDirectives: [
        {
          section: "Service",
          key: "IPAddressDeny",
          value: "any",
          source: "unit-file",
        },
      ],
    }),
  });
  const updateSandboxService = createUpdateSandboxService({
    metadataSource,
    systemdRuntime,
  });

  await expect(
    updateSandboxService("lab-api.service", {
      name: "lab-api",
      execStart: "/usr/bin/node server.js",
      sandboxProfile: "baseline",
    }),
  ).rejects.toBeInstanceOf(ManagedEntityConflictError);
});

test("deletes sandbox services through runtime and metadata", async () => {
  const metadataSource = createMetadataSource();
  const systemdRuntime = createRuntime();
  const deleteSandboxService = createDeleteSandboxService({
    metadataSource,
    systemdRuntime,
  });

  await expect(deleteSandboxService("lab-api.service")).resolves.toBeUndefined();
  expect(systemdRuntime.deleteSandboxService).toHaveBeenCalledWith("lab-api.service");
  expect(metadataSource.deleteManagedEntityMetadata).toHaveBeenCalledWith("lab-api.service");
});
