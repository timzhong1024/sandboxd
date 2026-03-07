import { expect, test } from "vitest";
import {
  getUnitType,
  isSandboxdManaged,
  mapSystemdUnitRecord,
  parseManagedEntities,
  type ManagedEntity,
} from "./index";

test("identifies sandboxd-managed entities", () => {
  const entity: ManagedEntity = {
    kind: "sandbox-service",
    origin: "sandboxd",
    unitName: "lab-api.service",
    unitType: "service",
    state: "active",
    labels: {},
  };

  expect(isSandboxdManaged(entity)).toBe(true);
});

test("parses a valid managed entity payload", () => {
  const entities = parseManagedEntities([
    {
      kind: "systemd-unit",
      origin: "external",
      unitName: "docker.service",
      unitType: "service",
      state: "active",
      labels: {},
    },
    {
      kind: "sandbox-service",
      origin: "sandboxd",
      unitName: "lab-api.service",
      unitType: "service",
      state: "active",
      labels: {},
    },
  ]);

  expect(entities).toHaveLength(2);
  expect(entities[1]).toMatchObject({ unitName: "lab-api.service" });
});

test("rejects an invalid managed entity payload", () => {
  expect(() => parseManagedEntities([{ unitName: "broken.service", labels: {} }])).toThrow(
    /field "kind" must be a string/i,
  );
});

test("maps a systemd unit record into the shared entity model", () => {
  const entity = mapSystemdUnitRecord({
    unitName: "docker.service",
    loadState: "loaded",
    activeState: "active",
    subState: "running",
    description: "Docker Application Container Engine",
  });

  expect(entity).toMatchObject({
    kind: "systemd-unit",
    origin: "external",
    unitName: "docker.service",
    unitType: "service",
    state: "active",
    labels: {
      description: "Docker Application Container Engine",
      loadState: "loaded",
      subState: "running",
    },
  });
});

test("derives sandbox-service when the unit looks sandboxd-owned", () => {
  const entity = mapSystemdUnitRecord({
    unitName: "lab-api.service",
    loadState: "loaded",
    activeState: "active",
    subState: "running",
    description: "Sandboxd managed lab API",
  });

  expect(entity.kind).toBe("sandbox-service");
  expect(entity.origin).toBe("sandboxd");
});

test("extracts a unit type suffix from the unit name", () => {
  expect(getUnitType("docker.service")).toBe("service");
  expect(getUnitType("sandboxd.slice")).toBe("slice");
  expect(getUnitType("no-suffix")).toBe("unknown");
});
