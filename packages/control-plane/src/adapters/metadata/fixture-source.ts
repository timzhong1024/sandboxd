import type {
  CreateSandboxServiceInput,
  DangerousAdoptManagedEntityInput,
  ManagedEntityDetail,
  ManagedEntitySummary,
} from "@sandboxd/core";
import { z } from "zod";
import {
  managedEntityFixtureNames,
  type ManagedEntityFixtureName,
  type ManagedEntityMetadataRecord,
  type ManagedEntityMetadataSourcePort,
} from "../../ports/managed-entity-metadata-source-port";

type FixtureStore = Record<ManagedEntityFixtureName, ManagedEntityDetail[]>;

function createCapabilities(origin: "external" | "sandboxd", state: string) {
  const sandboxdManaged = origin === "sandboxd";
  const active = state === "active";

  return {
    canInspect: true,
    canStart: sandboxdManaged && !active,
    canStop: sandboxdManaged && active,
    canRestart: sandboxdManaged && active,
  };
}

const initialManagedEntityFixtures: FixtureStore = {
  mixed: [
    {
      kind: "systemd-unit",
      origin: "external",
      unitName: "docker.service",
      unitType: "service",
      state: "active",
      subState: "running",
      loadState: "loaded",
      slice: "system.slice",
      description: "Docker Application Container Engine",
      labels: {
        source: "host",
      },
      capabilities: createCapabilities("external", "active"),
      resourceControls: {},
      sandboxing: {},
      status: {
        activeState: "active",
        subState: "running",
        loadState: "loaded",
      },
    },
    {
      kind: "sandbox-service",
      origin: "sandboxd",
      unitName: "lab-api.service",
      unitType: "service",
      state: "active",
      subState: "running",
      loadState: "loaded",
      slice: "sandboxd.slice",
      description: "Sandboxd managed lab API",
      labels: {
        source: "sandboxd",
      },
      sandboxProfile: "strict",
      capabilities: createCapabilities("sandboxd", "active"),
      resourceControls: {
        cpuWeight: "200",
        memoryMax: "512M",
      },
      sandboxing: {
        noNewPrivileges: true,
        privateTmp: true,
        protectSystem: "strict",
      },
      status: {
        activeState: "active",
        subState: "running",
        loadState: "loaded",
      },
    },
  ],
  "external-only": [
    {
      kind: "systemd-unit",
      origin: "external",
      unitName: "sshd.service",
      unitType: "service",
      state: "active",
      subState: "running",
      loadState: "loaded",
      slice: "system.slice",
      description: "OpenSSH server daemon",
      labels: {
        source: "host",
      },
      capabilities: createCapabilities("external", "active"),
      resourceControls: {},
      sandboxing: {},
      status: {
        activeState: "active",
        subState: "running",
        loadState: "loaded",
      },
    },
  ],
  empty: [],
};

interface CreateFixtureMetadataSourceOptions {
  defaultFixtureName?: ManagedEntityFixtureName;
}

const fixtureNameSchema = z.enum(managedEntityFixtureNames);

function cloneEntity(entity: ManagedEntityDetail): ManagedEntityDetail {
  return {
    ...entity,
    labels: { ...entity.labels },
    capabilities: { ...entity.capabilities },
    resourceControls: { ...entity.resourceControls },
    sandboxing: { ...entity.sandboxing },
    status: { ...entity.status },
  };
}

function toSummary(entity: ManagedEntityDetail): ManagedEntitySummary {
  const {
    resourceControls: _resourceControls,
    sandboxing: _sandboxing,
    status: _status,
    ...summary
  } = entity;

  return summary;
}

export function createFixtureMetadataSource(
  options: CreateFixtureMetadataSourceOptions = {},
): ManagedEntityMetadataSourcePort {
  const defaultFixtureName = options.defaultFixtureName ?? "mixed";
  const store: FixtureStore = {
    mixed: initialManagedEntityFixtures.mixed.map(cloneEntity),
    "external-only": initialManagedEntityFixtures["external-only"].map(cloneEntity),
    empty: initialManagedEntityFixtures.empty.map(cloneEntity),
  };

  function getFixture(fixtureName: ManagedEntityFixtureName) {
    return store[fixtureName];
  }

  return {
    async dangerouslyAdoptFallbackEntity(
      unitName: string,
      input: DangerousAdoptManagedEntityInput,
    ) {
      const fixture = store[defaultFixtureName];
      const index = fixture.findIndex((entity) => entity.unitName === unitName);
      if (index === -1) {
        return null;
      }

      const previous = fixture[index];
      if (!previous) {
        return null;
      }

      const next: ManagedEntityDetail = {
        ...previous,
        kind: "sandbox-service",
        origin: "sandboxd",
        sandboxProfile: input.sandboxProfile ?? previous.sandboxProfile,
        capabilities: createCapabilities("sandboxd", previous.state),
      };

      fixture[index] = next;
      return cloneEntity(next);
    },
    async dangerouslyAdoptManagedEntity(unitName, input) {
      return compactMetadataRecord({
        unitName,
        sandboxProfile: input.sandboxProfile,
        resourceControls: {},
        sandboxing: {},
        slice: "sandboxd.slice",
        description: undefined,
        workingDirectory: undefined,
      });
    },
    async deleteManagedEntityMetadata() {},
    async getManagedEntityMetadata(): Promise<ManagedEntityMetadataRecord | null> {
      return null;
    },
    async listFallbackEntitySummaries({ fixtureName = defaultFixtureName } = {}) {
      return getFixture(fixtureName).map((entity) => toSummary(cloneEntity(entity)));
    },
    async listManagedEntityMetadata(): Promise<ManagedEntityMetadataRecord[]> {
      return [];
    },
    async saveManagedEntityMetadata(unitName, input) {
      return compactMetadataRecord({
        unitName,
        description: input.description,
        workingDirectory: input.workingDirectory,
        slice: input.slice ?? "sandboxd.slice",
        sandboxProfile: input.sandboxProfile,
        resourceControls: { ...input.resourceControls },
        sandboxing: { ...input.sandboxing },
      });
    },
    async getFallbackEntityDetail(unitName, { fixtureName = defaultFixtureName } = {}) {
      const entity = getFixture(fixtureName).find((item) => item.unitName === unitName);
      return entity ? cloneEntity(entity) : null;
    },
    async createFallbackSandboxService(input: CreateSandboxServiceInput) {
      const unitName = input.name.endsWith(".service") ? input.name : `${input.name}.service`;
      const entity: ManagedEntityDetail = {
        kind: "sandbox-service",
        origin: "sandboxd",
        unitName,
        unitType: "service",
        state: "inactive",
        subState: "dead",
        loadState: "loaded",
        slice: input.slice ?? "sandboxd.slice",
        description: input.description ?? `Sandboxd managed ${input.name}`,
        labels: {
          source: "sandboxd-fixture",
          execStart: input.execStart,
        },
        sandboxProfile: input.sandboxProfile,
        capabilities: createCapabilities("sandboxd", "inactive"),
        resourceControls: { ...input.resourceControls },
        sandboxing: { ...input.sandboxing },
        status: {
          activeState: "inactive",
          subState: "dead",
          loadState: "loaded",
        },
      };

      store[defaultFixtureName] = [...store[defaultFixtureName], entity];
      return cloneEntity(entity);
    },
    async updateFallbackEntityState(unitName, state) {
      const fixture = store[defaultFixtureName];
      const index = fixture.findIndex((entity) => entity.unitName === unitName);
      if (index === -1) {
        return null;
      }

      const previous = fixture[index];
      if (!previous) {
        return null;
      }

      const nextState = state === "active" ? "running" : "dead";
      const next: ManagedEntityDetail = {
        ...previous,
        state,
        subState: nextState,
        capabilities: createCapabilities(previous.origin, state),
        status: {
          ...previous.status,
          activeState: state,
          subState: nextState,
        },
      };

      fixture[index] = next;
      return cloneEntity(next);
    },
  };
}

export function parseFixtureName(value: string | undefined): ManagedEntityFixtureName | undefined {
  if (!value) {
    return undefined;
  }

  return fixtureNameSchema.parse(value);
}

function compactMetadataRecord(record: {
  description: string | undefined;
  resourceControls: ManagedEntityMetadataRecord["resourceControls"];
  sandboxProfile: string | undefined;
  sandboxing: ManagedEntityMetadataRecord["sandboxing"];
  slice: string;
  unitName: string;
  workingDirectory: string | undefined;
}): ManagedEntityMetadataRecord {
  const next: ManagedEntityMetadataRecord = {
    unitName: record.unitName,
    slice: record.slice,
    resourceControls: record.resourceControls,
    sandboxing: record.sandboxing,
  };

  if (record.description) {
    next.description = record.description;
  }

  if (record.workingDirectory) {
    next.workingDirectory = record.workingDirectory;
  }

  if (record.sandboxProfile) {
    next.sandboxProfile = record.sandboxProfile;
  }

  return next;
}
