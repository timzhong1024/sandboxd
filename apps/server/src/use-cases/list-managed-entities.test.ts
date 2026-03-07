import { expect, test, vi } from "vitest";
import type { ManagedEntity } from "@sandboxd/core";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { createListManagedEntities } from "./list-managed-entities";

const fallbackEntities: ManagedEntity[] = [
  {
    kind: "systemd-unit",
    origin: "external",
    unitName: "docker.service",
    unitType: "service",
    state: "active",
    labels: {},
  },
];

test("returns mapped runtime entities when runtime succeeds", async () => {
  const runtime: SystemdRuntimePort = {
    listUnits: vi.fn().mockResolvedValue([
      {
        unitName: "docker.service",
        loadState: "loaded",
        activeState: "active",
        subState: "running",
        description: "Docker Application Container Engine",
      },
    ]),
  };
  const metadataSource: ManagedEntityMetadataSourcePort = {
    listFallbackEntities: vi.fn().mockResolvedValue(fallbackEntities),
  };

  const listManagedEntities = createListManagedEntities({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(listManagedEntities()).resolves.toMatchObject([{ unitName: "docker.service" }]);
  expect(metadataSource.listFallbackEntities).not.toHaveBeenCalled();
});

test("falls back to metadata when runtime throws", async () => {
  const runtime: SystemdRuntimePort = {
    listUnits: vi.fn().mockRejectedValue(new Error("unsupported")),
  };
  const metadataSource: ManagedEntityMetadataSourcePort = {
    listFallbackEntities: vi.fn().mockResolvedValue(fallbackEntities),
  };

  const listManagedEntities = createListManagedEntities({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(listManagedEntities()).resolves.toEqual(fallbackEntities);
});

test("falls back to metadata when runtime returns no units", async () => {
  const runtime: SystemdRuntimePort = {
    listUnits: vi.fn().mockResolvedValue([]),
  };
  const metadataSource: ManagedEntityMetadataSourcePort = {
    listFallbackEntities: vi.fn().mockResolvedValue(fallbackEntities),
  };

  const listManagedEntities = createListManagedEntities({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(listManagedEntities()).resolves.toEqual(fallbackEntities);
});

test("serves a forced fixture without touching runtime", async () => {
  const runtime: SystemdRuntimePort = {
    listUnits: vi.fn().mockResolvedValue([]),
  };
  const metadataSource: ManagedEntityMetadataSourcePort = {
    listFallbackEntities: vi.fn().mockResolvedValue(fallbackEntities),
  };

  const listManagedEntities = createListManagedEntities({
    metadataSource,
    systemdRuntime: runtime,
  });

  await expect(listManagedEntities({ fixtureName: "external-only" })).resolves.toEqual(
    fallbackEntities,
  );
  expect(runtime.listUnits).not.toHaveBeenCalled();
  expect(metadataSource.listFallbackEntities).toHaveBeenCalledWith({
    fixtureName: "external-only",
  });
});
