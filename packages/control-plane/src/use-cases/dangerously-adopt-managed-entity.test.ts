import { expect, test, vi } from "vitest";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { ManagedEntityConflictError, ManagedEntityNotFoundError } from "./managed-entity-errors";
import { createDangerouslyAdoptManagedEntity } from "./dangerously-adopt-managed-entity";

function createMetadataSource(): ManagedEntityMetadataSourcePort {
  let managedRecord: {
    unitName: string;
    resourceControls: {};
    sandboxing: {};
    sandboxProfile?: string;
  } | null = null;

  return {
    createFallbackSandboxService: vi.fn(),
    dangerouslyAdoptFallbackEntity: vi.fn().mockResolvedValue(null),
    dangerouslyAdoptManagedEntity: vi.fn().mockImplementation(async (unitName, input) => {
      managedRecord = {
        unitName,
        resourceControls: {},
        sandboxing: {},
        ...(input.sandboxProfile ? { sandboxProfile: input.sandboxProfile } : {}),
      };
      return managedRecord;
    }),
    deleteManagedEntityMetadata: vi.fn().mockResolvedValue(undefined),
    getFallbackEntityDetail: vi.fn().mockResolvedValue(null),
    getManagedEntityMetadata: vi.fn().mockImplementation(async () => managedRecord),
    listFallbackEntitySummaries: vi.fn().mockResolvedValue([]),
    listManagedEntityMetadata: vi.fn().mockResolvedValue([]),
    saveManagedEntityMetadata: vi.fn(),
    updateFallbackEntityState: vi.fn().mockResolvedValue(null),
  };
}

function createRuntime(overrides: Partial<SystemdRuntimePort>): SystemdRuntimePort {
  return {
    createSandboxService: vi.fn().mockResolvedValue(undefined),
    getUnit: vi.fn().mockResolvedValue({
      unitName: "docker.service",
      loadState: "loaded",
      activeState: "active",
      subState: "running",
      description: "Docker Application Container Engine",
      slice: "system.slice",
      resourceControls: {},
      sandboxing: {},
    }),
    listUnits: vi.fn().mockResolvedValue([]),
    reloadSystemd: vi.fn().mockResolvedValue(undefined),
    restartUnit: vi.fn().mockResolvedValue(undefined),
    startUnit: vi.fn().mockResolvedValue(undefined),
    stopUnit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

test("dangerously adopts an existing service and reloads systemd", async () => {
  const metadataSource = createMetadataSource();
  const runtime = createRuntime({});

  const dangerouslyAdoptManagedEntity = createDangerouslyAdoptManagedEntity({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(
    dangerouslyAdoptManagedEntity("docker.service", {
      sandboxProfile: "baseline",
    }),
  ).resolves.toMatchObject({
    unitName: "docker.service",
    origin: "sandboxd",
    kind: "sandbox-service",
    sandboxProfile: "baseline",
  });

  expect(metadataSource.dangerouslyAdoptManagedEntity).toHaveBeenCalledWith("docker.service", {
    sandboxProfile: "baseline",
  });
  expect(runtime.reloadSystemd).toHaveBeenCalledOnce();
});

test("rejects dangerous adopt for non-service units", async () => {
  const metadataSource = createMetadataSource();
  const runtime = createRuntime({
    getUnit: vi.fn().mockResolvedValue({
      unitName: "sandboxd.slice",
      loadState: "loaded",
      activeState: "active",
      subState: "active",
      description: "Sandboxd Root Slice",
      resourceControls: {},
      sandboxing: {},
    }),
  });

  const dangerouslyAdoptManagedEntity = createDangerouslyAdoptManagedEntity({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(dangerouslyAdoptManagedEntity("sandboxd.slice", {})).rejects.toBeInstanceOf(
    ManagedEntityConflictError,
  );
  expect(metadataSource.dangerouslyAdoptManagedEntity).not.toHaveBeenCalled();
});

test("falls back when runtime is unavailable in fixture mode", async () => {
  const metadataSource = createMetadataSource();
  vi.mocked(metadataSource.dangerouslyAdoptFallbackEntity).mockResolvedValue({
    unitName: "docker.service",
    kind: "sandbox-service",
    origin: "sandboxd",
    unitType: "service",
    state: "active",
    subState: "running",
    loadState: "loaded",
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
  });
  const runtime = createRuntime({
    getUnit: vi
      .fn()
      .mockRejectedValue(new Error("systemctl runtime disabled while fixture mode is enabled")),
  });

  const dangerouslyAdoptManagedEntity = createDangerouslyAdoptManagedEntity({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(dangerouslyAdoptManagedEntity("docker.service", {})).resolves.toMatchObject({
    unitName: "docker.service",
    origin: "sandboxd",
  });
});

test("rejects dangerous adopt when unit does not exist", async () => {
  const metadataSource = createMetadataSource();
  const runtime = createRuntime({
    getUnit: vi.fn().mockResolvedValue(null),
  });

  const dangerouslyAdoptManagedEntity = createDangerouslyAdoptManagedEntity({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(dangerouslyAdoptManagedEntity("missing.service", {})).rejects.toBeInstanceOf(
    ManagedEntityNotFoundError,
  );
});
