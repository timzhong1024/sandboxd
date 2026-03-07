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
    listFallbackEntitySummaries: vi.fn().mockResolvedValue([]),
    getFallbackEntityDetail: vi.fn().mockResolvedValue(createEntityDetail()),
    createFallbackSandboxService: vi.fn(),
    updateFallbackEntityState: vi.fn(),
  };
}

function createRuntime(overrides: Partial<SystemdRuntimePort>): SystemdRuntimePort {
  return {
    listUnits: vi.fn().mockResolvedValue([]),
    getUnit: vi.fn().mockResolvedValue(null),
    startUnit: vi.fn().mockResolvedValue(undefined),
    stopUnit: vi.fn().mockResolvedValue(undefined),
    restartUnit: vi.fn().mockResolvedValue(undefined),
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
