import { expect, test } from "vitest";
import {
  getSupportedAdvancedPropertySpec,
  getManagedEntityCapabilities,
  parseAdvancedPropertyDirective,
  supportedAdvancedPropertySpecs,
  getUnitType,
  isSandboxdManaged,
  mapSystemdUnitDetailRecord,
  mapSystemdUnitRecord,
  parseCreateSandboxServiceInput,
  parseDangerousAdoptManagedEntityInput,
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

test("parses a valid create sandbox service input payload with advanced properties", () => {
  const input = parseCreateSandboxServiceInput({
    name: "lab-api",
    execStart: "/usr/bin/node server.js",
    advancedProperties: {
      ReadOnlyPaths: [
        {
          parsed: ["/usr", "/etc"],
        },
      ],
      PrivateNetwork: {
        parsed: true,
      },
    },
  });

  expect(input.advancedProperties?.ReadOnlyPaths).toEqual([
    {
      parsed: ["/usr", "/etc"],
    },
  ]);
  expect(input.advancedProperties?.PrivateNetwork).toEqual({
    parsed: true,
  });
});

test("accepts official legal advanced property values", () => {
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
    advancedProperties: {
      ProtectSystem: {
        parsed: true,
      },
      PrivateTmp: {
        parsed: "disconnected",
      },
      MemoryMax: {
        parsed: {
          kind: "infinity",
        },
      },
      TasksMax: {
        parsed: {
          kind: "percentage",
          value: 50,
        },
      },
    },
    status: {
      activeState: "active",
      subState: "running",
      loadState: "loaded",
    },
  });

  expect(entity.advancedProperties?.ProtectSystem).toEqual({
    parsed: true,
  });
  expect(entity.advancedProperties?.PrivateTmp).toEqual({
    parsed: "disconnected",
  });
  expect(entity.advancedProperties?.MemoryMax).toEqual({
    parsed: {
      kind: "infinity",
    },
  });
});

test("accepts complex allow deny reset boolean mode representations", () => {
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
    advancedProperties: {
      CapabilityBoundingSet: [
        {
          parsed: {
            mode: "deny",
            values: ["CAP_SYS_ADMIN"],
          },
        },
      ],
      RestrictNamespaces: [
        {
          parsed: {
            mode: "boolean",
            value: true,
          },
        },
      ],
      SystemCallFilter: [
        {
          parsed: {
            mode: "reset",
          },
        },
      ],
      RestrictAddressFamilies: [
        {
          parsed: {
            mode: "allow",
            values: ["AF_UNIX", "AF_INET"],
          },
        },
      ],
    },
    status: {
      activeState: "active",
      subState: "running",
      loadState: "loaded",
    },
  });

  expect(entity.advancedProperties?.CapabilityBoundingSet?.[0]?.parsed).toMatchObject({
    mode: "deny",
  });
  expect(entity.advancedProperties?.RestrictNamespaces?.[0]?.parsed).toMatchObject({
    mode: "boolean",
    value: true,
  });
  expect(entity.advancedProperties?.SystemCallFilter?.[0]?.parsed).toMatchObject({
    mode: "reset",
  });
});

test("accepts parsed and raw environment dual mode", () => {
  const parsed = parseManagedEntityDetail({
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
    advancedProperties: {
      Environment: [
        {
          parsed: {
            NODE_ENV: "production",
          },
        },
      ],
    },
    status: {
      activeState: "active",
      subState: "running",
      loadState: "loaded",
    },
  });
  const raw = parseManagedEntityDetail({
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
    advancedProperties: {
      Environment: [{ raw: 'NODE_ENV="production mode"' }],
    },
    status: {
      activeState: "active",
      subState: "running",
      loadState: "loaded",
    },
  });

  expect(parsed.advancedProperties?.Environment?.[0]?.parsed).toMatchObject({
    NODE_ENV: "production",
  });
  expect(raw.advancedProperties?.Environment?.[0]?.raw).toBe('NODE_ENV="production mode"');
});

test("parses single advanced property directives through the shared parser registry", () => {
  expect(parseAdvancedPropertyDirective("ProtectSystem", "yes")).toEqual({
    parsed: true,
  });
  expect(parseAdvancedPropertyDirective("PrivateTmp", "disconnected")).toEqual({
    parsed: "disconnected",
  });
  expect(parseAdvancedPropertyDirective("RestrictNamespaces", "yes")).toEqual([
    {
      parsed: {
        mode: "boolean",
        value: true,
      },
    },
  ]);
});

test("falls back to raw when a known property value cannot be safely structured", () => {
  expect(
    parseAdvancedPropertyDirective("SystemCallFilter", "@system-service ~@privileged"),
  ).toEqual([{ raw: "@system-service ~@privileged" }]);
  expect(parseAdvancedPropertyDirective("CPUWeight", "200foo")).toEqual({
    raw: "200foo",
  });
  expect(parseAdvancedPropertyDirective("Environment", 'BROKEN "unterminated')).toEqual([
    { raw: 'BROKEN "unterminated' },
  ]);
});

test("accepts empty raw fallback values for known properties", () => {
  const entity = parseManagedEntityDetail({
    kind: "sandbox-service",
    origin: "sandboxd",
    unitName: "lab-api.service",
    unitType: "service",
    state: "inactive",
    labels: {},
    capabilities: {
      canInspect: true,
      canStart: true,
      canStop: false,
      canRestart: false,
    },
    resourceControls: {},
    sandboxing: {},
    advancedProperties: {
      ProtectSystem: {
        raw: "",
      },
    },
    status: {
      activeState: "inactive",
      subState: "dead",
      loadState: "loaded",
    },
  });

  expect(entity.advancedProperties?.ProtectSystem).toEqual({
    raw: "",
  });
});

test("parses a valid create sandbox service input payload", () => {
  const input = parseCreateSandboxServiceInput({
    name: "lab-api",
    execStart: "/usr/bin/node server.js",
  });

  expect(input.name).toBe("lab-api");
});

test("parses a valid dangerous adopt input payload", () => {
  const input = parseDangerousAdoptManagedEntityInput({
    sandboxProfile: "strict",
  });

  expect(input.sandboxProfile).toBe("strict");
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

test("exposes the first-batch advanced property registry", () => {
  expect(supportedAdvancedPropertySpecs).toHaveLength(19);
  expect(getSupportedAdvancedPropertySpec("ProtectSystem")).toMatchObject({
    key: "ProtectSystem",
    group: "filesystem",
    level: "recommended",
    supportsRawFallback: true,
    supportStatus: "inspect-only",
  });
  expect(getSupportedAdvancedPropertySpec("RestrictNamespaces")).toMatchObject({
    supportedModes: ["allow", "deny", "reset", "boolean"],
    valueType: "mode-list",
  });
});
