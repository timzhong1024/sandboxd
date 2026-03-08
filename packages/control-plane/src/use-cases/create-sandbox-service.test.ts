import { expect, test, vi } from "vitest";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { createCreateSandboxService } from "./create-sandbox-service";

function createMetadataSource(): ManagedEntityMetadataSourcePort {
  return {
    deleteFallbackSandboxService: vi.fn().mockResolvedValue(false),
    deleteManagedEntityMetadata: vi.fn().mockResolvedValue(undefined),
    dangerouslyAdoptFallbackEntity: vi.fn().mockResolvedValue(null),
    dangerouslyAdoptManagedEntity: vi.fn(),
    getFallbackEntityDetail: vi.fn().mockResolvedValue(null),
    getManagedEntityMetadata: vi.fn().mockResolvedValue({
      unitName: "lab-api.service",
      sandboxProfile: "strict",
      resourceControls: {
        cpuWeight: "200",
      },
      sandboxing: {
        noNewPrivileges: true,
      },
      slice: "sandboxd.slice",
    }),
    listFallbackEntitySummaries: vi.fn().mockResolvedValue([]),
    listManagedEntityMetadata: vi.fn().mockResolvedValue([]),
    saveManagedEntityMetadata: vi.fn().mockResolvedValue({
      unitName: "lab-api.service",
      sandboxProfile: "strict",
      resourceControls: {
        cpuWeight: "200",
      },
      sandboxing: {
        noNewPrivileges: true,
      },
      slice: "sandboxd.slice",
    }),
    createFallbackSandboxService: vi.fn(),
    updateFallbackSandboxService: vi.fn().mockResolvedValue(null),
    updateFallbackEntityState: vi.fn().mockResolvedValue(null),
    updateManagedEntityMetadata: vi.fn(),
  };
}

function createRuntime(overrides: Partial<SystemdRuntimePort>): SystemdRuntimePort {
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

test("creates sandbox services through the runtime and metadata source", async () => {
  const metadataSource = createMetadataSource();
  const runtime = createRuntime({});

  const createSandboxService = createCreateSandboxService({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(
    createSandboxService({
      name: "lab-api",
      execStart: "/usr/bin/node server.js",
      sandboxProfile: "strict",
      resourceControls: {
        cpuWeight: "200",
      },
      sandboxing: {
        noNewPrivileges: true,
      },
    }),
  ).resolves.toMatchObject({
    unitName: "lab-api.service",
    sandboxProfile: "strict",
  });

  expect(metadataSource.saveManagedEntityMetadata).toHaveBeenCalledWith(
    "lab-api.service",
    expect.objectContaining({
      name: "lab-api",
    }),
  );
  expect(runtime.createSandboxService).toHaveBeenCalledWith(
    "lab-api.service",
    expect.objectContaining({
      name: "lab-api",
    }),
  );
});

test("removes metadata if runtime creation fails", async () => {
  const metadataSource = createMetadataSource();
  const runtimeError = new Error("Permission denied");
  const runtime = createRuntime({
    createSandboxService: vi.fn().mockRejectedValue(runtimeError),
  });

  const createSandboxService = createCreateSandboxService({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(
    createSandboxService({
      name: "lab-api",
      execStart: "/usr/bin/node server.js",
    }),
  ).rejects.toBe(runtimeError);
  expect(metadataSource.deleteManagedEntityMetadata).toHaveBeenCalledWith("lab-api.service");
});
