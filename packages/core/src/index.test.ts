import { expect, test } from "vitest";
import {
  getManagedEntityCapabilities,
  getUnitType,
  isSandboxdManaged,
  mapSystemdUnitDetailRecord,
  mapSystemdUnitRecord,
  parseCreateSandboxServiceInput,
  parseManagedEntityDetail,
  parseManagedEntitySummaries,
  type ManagedEntitySummary,
} from "./index";

test("identifies sandboxd-managed entities", () => {
  const entity: ManagedEntitySummary = {
    kind: "sandbox-service",
    origin: "sandboxd",
    unitName: "lab-api.service",
    unitType: "service",
    state: "active",
    labels: {},
    capabilities: {
      canInspect: true,
      canStart: false,
      canStop: true,
      canRestart: true,
    },
  };

  expect(isSandboxdManaged(entity)).toBe(true);
});

test("derives capabilities from origin and state", () => {
  expect(
    getManagedEntityCapabilities({
      origin: "sandboxd",
      state: "active",
    }),
  ).toEqual({
    canInspect: true,
    canStart: false,
    canStop: true,
    canRestart: true,
  });
});

test("parses valid managed entity summaries", () => {
  const entities = parseManagedEntitySummaries([
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
  ]);

  expect(entities).toHaveLength(1);
  expect(entities[0]).toMatchObject({ unitName: "docker.service" });
});

test("parses a valid managed entity detail payload", () => {
  const entity = parseManagedEntityDetail({
    kind: "sandbox-service",
    origin: "sandboxd",
    unitName: "lab-api.service",
    unitType: "service",
    state: "active",
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

  expect(entity.status.subState).toBe("running");
});

test("parses a valid create sandbox service input payload", () => {
  const input = parseCreateSandboxServiceInput({
    name: "lab-api",
    execStart: "/usr/bin/node server.js",
  });

  expect(input.name).toBe("lab-api");
});

test("rejects an invalid managed entity summary payload", () => {
  expect(() => parseManagedEntitySummaries([{ unitName: "broken.service", labels: {} }])).toThrow(
    /"kind"/i,
  );
});

test("maps a systemd unit record into the shared summary model", () => {
  const entity = mapSystemdUnitRecord({
    unitName: "docker.service",
    loadState: "loaded",
    activeState: "active",
    subState: "running",
    description: "Docker Application Container Engine",
    slice: "system.slice",
  });

  expect(entity).toMatchObject({
    kind: "systemd-unit",
    origin: "external",
    unitName: "docker.service",
    unitType: "service",
    state: "active",
    subState: "running",
    loadState: "loaded",
    slice: "system.slice",
    description: "Docker Application Container Engine",
  });
});

test("maps a systemd unit detail record into the shared detail model", () => {
  const entity = mapSystemdUnitDetailRecord({
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
  });

  expect(entity.kind).toBe("systemd-unit");
  expect(entity.origin).toBe("external");
  expect(entity.resourceControls.cpuWeight).toBe("200");
  expect(entity.sandboxing.noNewPrivileges).toBe(true);
});

test("does not infer sandboxd ownership from unit naming or description", () => {
  const entity = mapSystemdUnitRecord({
    unitName: "lab-api.service",
    loadState: "loaded",
    activeState: "active",
    subState: "running",
    description: "Sandboxd managed lab API",
  });

  expect(entity).toMatchObject({
    kind: "systemd-unit",
    origin: "external",
    capabilities: {
      canInspect: true,
      canStart: false,
      canStop: false,
      canRestart: false,
    },
  });
  expect(entity.sandboxProfile).toBeUndefined();
});

test("extracts a unit type suffix from the unit name", () => {
  expect(getUnitType("docker.service")).toBe("service");
  expect(getUnitType("sandboxd.slice")).toBe("slice");
  expect(getUnitType("no-suffix")).toBe("unknown");
});
