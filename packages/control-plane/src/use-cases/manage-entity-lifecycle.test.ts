import { expect, test, vi } from "vitest";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { ManagedEntityConflictError } from "./managed-entity-errors";
import { createRestartManagedEntity } from "./restart-managed-entity";
import { createStartManagedEntity } from "./start-managed-entity";
import { createStopManagedEntity } from "./stop-managed-entity";

function createEntityDetail(unitName = "lab-api.service", state = "active") {
  return {
    kind: "sandbox-service" as const,
    origin: "sandboxd" as const,
    unitName,
    unitType: "service",
    state,
    subState: state === "active" ? "running" : "dead",
    loadState: "loaded",
    description: "Sandboxd managed lab API",
    labels: {},
    capabilities: {
      canInspect: true,
      canStart: state !== "active",
      canStop: state === "active",
      canRestart: state === "active",
    },
    resourceControls: {},
    sandboxing: {},
    status: {
      activeState: state,
      subState: state === "active" ? "running" : "dead",
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
      resourceControls: {},
      sandboxing: {},
      slice: "sandboxd.slice",
    }),
    getFallbackEntityDetail: vi.fn().mockResolvedValue(createEntityDetail()),
    saveManagedEntityMetadata: vi.fn(),
    createFallbackSandboxService: vi.fn(),
    updateFallbackSandboxService: vi.fn().mockResolvedValue(null),
    updateFallbackEntityState: vi
      .fn()
      .mockImplementation(async (_unitName: string, state: string) =>
        createEntityDetail("lab-api.service", state),
      ),
    updateManagedEntityMetadata: vi.fn(),
  };
}

function createRuntime(overrides: Partial<SystemdRuntimePort>): SystemdRuntimePort {
  return {
    createSandboxService: vi.fn().mockResolvedValue(undefined),
    deleteSandboxService: vi.fn().mockResolvedValue(undefined),
    listUnits: vi.fn().mockResolvedValue([]),
    getUnit: vi.fn().mockResolvedValue({
      unitName: "lab-api.service",
      loadState: "loaded",
      activeState: "active",
      subState: "running",
      description: "Sandboxd managed lab API",
    }),
    reloadSystemd: vi.fn().mockResolvedValue(undefined),
    startUnit: vi.fn().mockResolvedValue(undefined),
    stopUnit: vi.fn().mockResolvedValue(undefined),
    restartUnit: vi.fn().mockResolvedValue(undefined),
    updateSandboxService: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

test("start falls back to metadata when runtime is unavailable", async () => {
  const metadataSource = createMetadataSource();
  vi.mocked(metadataSource.getManagedEntityMetadata).mockResolvedValue({
    unitName: "lab-api.service",
    sandboxProfile: "strict",
    resourceControls: {},
    sandboxing: {},
    slice: "sandboxd.slice",
  });
  const runtime = createRuntime({
    getUnit: vi.fn().mockResolvedValue({
      unitName: "lab-api.service",
      loadState: "loaded",
      activeState: "inactive",
      subState: "dead",
      description: "Sandboxd managed lab API",
    }),
    startUnit: vi
      .fn()
      .mockRejectedValue(new Error("systemctl runtime disabled while fixture mode is enabled")),
  });

  const startManagedEntity = createStartManagedEntity({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(startManagedEntity("lab-api.service")).resolves.toMatchObject({
    state: "active",
  });
  expect(metadataSource.updateFallbackEntityState).toHaveBeenCalledWith(
    "lab-api.service",
    "active",
  );
});

test("start surfaces runtime action failures instead of mutating fixture state", async () => {
  const metadataSource = createMetadataSource();
  const runtimeError = new Error("Failed to start lab-api.service");
  const runtime = createRuntime({
    getUnit: vi.fn().mockResolvedValue({
      unitName: "lab-api.service",
      loadState: "loaded",
      activeState: "inactive",
      subState: "dead",
      description: "Sandboxd managed lab API",
    }),
    startUnit: vi.fn().mockRejectedValue(runtimeError),
  });

  const startManagedEntity = createStartManagedEntity({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(startManagedEntity("lab-api.service")).rejects.toBe(runtimeError);
  expect(metadataSource.updateFallbackEntityState).not.toHaveBeenCalled();
});

test("stop falls back to metadata when runtime is unavailable", async () => {
  const metadataSource = createMetadataSource();
  const runtime = createRuntime({
    stopUnit: vi.fn().mockRejectedValue(new Error("systemctl runtime is only available on Linux")),
  });

  const stopManagedEntity = createStopManagedEntity({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(stopManagedEntity("lab-api.service")).resolves.toMatchObject({
    state: "inactive",
  });
  expect(metadataSource.updateFallbackEntityState).toHaveBeenCalledWith(
    "lab-api.service",
    "inactive",
  );
});

test("restart falls back to metadata when runtime is unavailable", async () => {
  const metadataSource = createMetadataSource();
  const runtime = createRuntime({
    restartUnit: vi
      .fn()
      .mockRejectedValue(new Error("systemctl runtime disabled while fixture mode is enabled")),
  });

  const restartManagedEntity = createRestartManagedEntity({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(restartManagedEntity("lab-api.service")).resolves.toMatchObject({
    state: "active",
  });
  expect(metadataSource.updateFallbackEntityState).toHaveBeenCalledWith(
    "lab-api.service",
    "active",
  );
});

test("rejects actions for non-managed entities", async () => {
  const metadataSource = createMetadataSource();
  vi.mocked(metadataSource.getManagedEntityMetadata).mockResolvedValue(null);
  const runtime = createRuntime({
    getUnit: vi.fn().mockResolvedValue({
      unitName: "docker.service",
      loadState: "loaded",
      activeState: "active",
      subState: "running",
      description: "Docker Application Container Engine",
    }),
  });

  const stopManagedEntity = createStopManagedEntity({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(stopManagedEntity("docker.service")).rejects.toBeInstanceOf(
    ManagedEntityConflictError,
  );
  expect(runtime.stopUnit).not.toHaveBeenCalled();
});

test("rejects actions for units that only look sandboxd-managed by naming", async () => {
  const metadataSource = createMetadataSource();
  vi.mocked(metadataSource.getManagedEntityMetadata).mockResolvedValue(null);
  const runtime = createRuntime({
    getUnit: vi.fn().mockResolvedValue({
      unitName: "lab-api.service",
      loadState: "loaded",
      activeState: "active",
      subState: "running",
      description: "Sandboxd managed lab API",
    }),
  });

  const restartManagedEntity = createRestartManagedEntity({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(restartManagedEntity("lab-api.service")).rejects.toBeInstanceOf(
    ManagedEntityConflictError,
  );
  expect(runtime.restartUnit).not.toHaveBeenCalled();
});
