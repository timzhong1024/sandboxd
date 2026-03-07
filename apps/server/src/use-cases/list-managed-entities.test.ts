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
    listFallbackEntitySummaries: vi.fn().mockResolvedValue(fallbackEntities),
    getFallbackEntityDetail: vi.fn().mockResolvedValue(null),
    createFallbackSandboxService: vi.fn(),
    updateFallbackEntityState: vi.fn().mockResolvedValue(null),
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

test("falls back to metadata when runtime throws", async () => {
  const runtime = createRuntime({
    listUnits: vi.fn().mockRejectedValue(new Error("unsupported")),
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
