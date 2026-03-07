import { expect, test, vi } from "vitest";
import type { ManagedEntitySummary } from "@sandboxd/core";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { createListManagedEntities } from "./list-managed-entities";

const fallbackEntities: ManagedEntitySummary[] = [
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
];

function createMetadataSource(): ManagedEntityMetadataSourcePort {
  return {
    deleteManagedEntityMetadata: vi.fn(),
    listFallbackEntitySummaries: vi.fn().mockResolvedValue(fallbackEntities),
    listManagedEntityMetadata: vi.fn().mockResolvedValue([]),
    getManagedEntityMetadata: vi.fn().mockResolvedValue(null),
    getFallbackEntityDetail: vi.fn().mockResolvedValue(null),
    saveManagedEntityMetadata: vi.fn(),
    createFallbackSandboxService: vi.fn(),
    updateFallbackEntityState: vi.fn().mockResolvedValue(null),
  };
}

function createRuntime(overrides: Partial<SystemdRuntimePort>): SystemdRuntimePort {
  return {
    createSandboxService: vi.fn().mockResolvedValue(undefined),
    listUnits: vi.fn().mockResolvedValue([]),
    getUnit: vi.fn().mockResolvedValue(null),
    startUnit: vi.fn().mockResolvedValue(undefined),
    stopUnit: vi.fn().mockResolvedValue(undefined),
    restartUnit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

test("returns mapped runtime entities when runtime succeeds", async () => {
  const runtime = createRuntime({
    listUnits: vi.fn().mockResolvedValue([
      {
        unitName: "docker.service",
        loadState: "loaded",
        activeState: "active",
        subState: "running",
        description: "Docker Application Container Engine",
      },
    ]),
  });
  const metadataSource = createMetadataSource();

  const listManagedEntities = createListManagedEntities({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(listManagedEntities()).resolves.toMatchObject([{ unitName: "docker.service" }]);
  expect(metadataSource.listFallbackEntitySummaries).not.toHaveBeenCalled();
});

test("merges sandboxd metadata into runtime summaries and includes metadata-only units", async () => {
  const runtime = createRuntime({
    getUnit: vi.fn().mockResolvedValue({
      unitName: "lab-worker.service",
      loadState: "loaded",
      activeState: "inactive",
      subState: "dead",
      description: "Sandboxd managed lab worker",
      slice: "sandboxd.slice",
      resourceControls: {
        cpuWeight: "200",
      },
      sandboxing: {},
    }),
    listUnits: vi.fn().mockResolvedValue([
      {
        unitName: "lab-api.service",
        loadState: "loaded",
        activeState: "active",
        subState: "running",
        description: "Sandboxd managed lab API",
      },
    ]),
  });
  const metadataSource = createMetadataSource();
  vi.mocked(metadataSource.listManagedEntityMetadata).mockResolvedValue([
    {
      unitName: "lab-api.service",
      sandboxProfile: "strict",
      resourceControls: {},
      sandboxing: {},
      slice: "sandboxd.slice",
    },
    {
      unitName: "lab-worker.service",
      sandboxProfile: "baseline",
      resourceControls: {},
      sandboxing: {},
      slice: "sandboxd.slice",
    },
  ]);

  const listManagedEntities = createListManagedEntities({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(listManagedEntities()).resolves.toMatchObject([
    { unitName: "lab-api.service", origin: "sandboxd", sandboxProfile: "strict" },
    { unitName: "lab-worker.service", origin: "sandboxd", sandboxProfile: "baseline" },
  ]);
});

test("falls back to metadata when runtime is disabled by fixture mode", async () => {
  const runtime = createRuntime({
    listUnits: vi
      .fn()
      .mockRejectedValue(new Error("systemctl runtime disabled while fixture mode is enabled")),
  });
  const metadataSource = createMetadataSource();

  const listManagedEntities = createListManagedEntities({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(listManagedEntities()).resolves.toEqual(fallbackEntities);
});

test("falls back to metadata when runtime returns no units", async () => {
  const runtime = createRuntime({
    listUnits: vi.fn().mockResolvedValue([]),
  });
  const metadataSource = createMetadataSource();

  const listManagedEntities = createListManagedEntities({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(listManagedEntities()).resolves.toEqual(fallbackEntities);
});

test("serves a forced fixture without touching runtime", async () => {
  const runtime = createRuntime({
    listUnits: vi.fn().mockResolvedValue([]),
  });
  const metadataSource = createMetadataSource();

  const listManagedEntities = createListManagedEntities({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(listManagedEntities({ fixtureName: "external-only" })).resolves.toEqual(
    fallbackEntities,
  );
  expect(runtime.listUnits).not.toHaveBeenCalled();
  expect(metadataSource.listFallbackEntitySummaries).toHaveBeenCalledWith({
    fixtureName: "external-only",
  });
});
