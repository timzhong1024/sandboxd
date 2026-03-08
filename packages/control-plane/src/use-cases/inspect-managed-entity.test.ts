import { expect, test, vi } from "vitest";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { createInspectManagedEntity } from "./inspect-managed-entity";

function createEntityDetail(unitName = "lab-api.service") {
  return {
    kind: "sandbox-service" as const,
    origin: "sandboxd" as const,
    unitName,
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

function createMetadataSource(): ManagedEntityMetadataSourcePort {
  return {
    deleteFallbackSandboxService: vi.fn().mockResolvedValue(false),
    deleteManagedEntityMetadata: vi.fn(),
    dangerouslyAdoptFallbackEntity: vi.fn().mockResolvedValue(null),
    dangerouslyAdoptManagedEntity: vi.fn(),
    listFallbackEntitySummaries: vi.fn().mockResolvedValue([]),
    listManagedEntityMetadata: vi.fn().mockResolvedValue([]),
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
    getFallbackEntityDetail: vi.fn().mockResolvedValue(createEntityDetail()),
    saveManagedEntityMetadata: vi.fn(),
    createFallbackSandboxService: vi.fn(),
    updateFallbackSandboxService: vi.fn().mockResolvedValue(null),
    updateFallbackEntityState: vi.fn(),
    updateManagedEntityMetadata: vi.fn(),
  };
}

function createRuntime(overrides: Partial<SystemdRuntimePort>): SystemdRuntimePort {
  return {
    createSandboxService: vi.fn().mockResolvedValue(undefined),
    deleteSandboxService: vi.fn().mockResolvedValue(undefined),
    listUnits: vi.fn().mockResolvedValue([]),
    getUnit: vi.fn().mockResolvedValue(null),
    reloadSystemd: vi.fn().mockResolvedValue(undefined),
    startUnit: vi.fn().mockResolvedValue(undefined),
    stopUnit: vi.fn().mockResolvedValue(undefined),
    restartUnit: vi.fn().mockResolvedValue(undefined),
    updateSandboxService: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

test("falls back to fixture metadata when runtime is disabled by fixture mode", async () => {
  const metadataSource = createMetadataSource();
  const runtime = createRuntime({
    getUnit: vi
      .fn()
      .mockRejectedValue(new Error("systemctl runtime disabled while fixture mode is enabled")),
  });

  const inspectManagedEntity = createInspectManagedEntity({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(inspectManagedEntity("lab-api.service")).resolves.toMatchObject({
    unitName: "lab-api.service",
  });
  expect(metadataSource.getFallbackEntityDetail).toHaveBeenCalledWith("lab-api.service");
});

test("merges managed metadata into runtime details", async () => {
  const metadataSource = createMetadataSource();
  const runtime = createRuntime({
    getUnit: vi.fn().mockResolvedValue({
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

  const inspectManagedEntity = createInspectManagedEntity({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(inspectManagedEntity("lab-api.service")).resolves.toMatchObject({
    sandboxProfile: "strict",
    resourceControls: { cpuWeight: "200" },
    sandboxing: { noNewPrivileges: true },
  });
});

test("prefers runtime-backed properties over duplicated metadata declarations", async () => {
  const metadataSource = createMetadataSource();
  metadataSource.getManagedEntityMetadata = vi.fn().mockResolvedValue({
    unitName: "lab-api.service",
    sandboxProfile: "strict",
    resourceControls: {
      cpuWeight: "200",
    },
    sandboxing: {
      noNewPrivileges: true,
    },
    advancedProperties: {
      CPUWeight: {
        parsed: {
          kind: "value",
          value: 200,
        },
      },
      NoNewPrivileges: {
        parsed: true,
      },
    },
    slice: "sandboxd.slice",
  });
  const runtime = createRuntime({
    getUnit: vi.fn().mockResolvedValue({
      unitName: "lab-api.service",
      loadState: "loaded",
      activeState: "active",
      subState: "running",
      description: "Sandboxd managed lab API",
      slice: "sandboxd.slice",
      resourceControls: {
        cpuWeight: "200",
      },
      sandboxing: {
        noNewPrivileges: true,
      },
    }),
  });

  const inspectManagedEntity = createInspectManagedEntity({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(inspectManagedEntity("lab-api.service")).resolves.toMatchObject({
    validation: {
      errors: [],
    },
    advancedProperties: {
      CPUWeight: {
        parsed: {
          kind: "value",
          value: 200,
        },
      },
      NoNewPrivileges: {
        parsed: true,
      },
    },
  });
});

test("surfaces runtime lookup failures instead of serving fixture data", async () => {
  const metadataSource = createMetadataSource();
  const runtimeError = new Error("Unit lab-api.service not found.");
  const runtime = createRuntime({
    getUnit: vi.fn().mockRejectedValue(runtimeError),
  });

  const inspectManagedEntity = createInspectManagedEntity({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(inspectManagedEntity("lab-api.service")).rejects.toBe(runtimeError);
  expect(metadataSource.getFallbackEntityDetail).not.toHaveBeenCalled();
});
