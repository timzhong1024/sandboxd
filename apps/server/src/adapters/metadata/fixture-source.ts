import type { ManagedEntity } from "@sandboxd/core";
import { z } from "zod";
import {
  managedEntityFixtureNames,
  type ManagedEntityFixtureName,
  type ManagedEntityMetadataSourcePort,
} from "../../ports/managed-entity-metadata-source-port";

const managedEntityFixtures: Record<ManagedEntityFixtureName, ManagedEntity[]> = {
  mixed: [
    {
      kind: "systemd-unit",
      origin: "external",
      unitName: "docker.service",
      unitType: "service",
      state: "active",
      slice: "system.slice",
      labels: {
        source: "host",
      },
    },
    {
      kind: "sandbox-service",
      origin: "sandboxd",
      unitName: "lab-api.service",
      unitType: "service",
      state: "active",
      slice: "sandboxd.slice",
      labels: {
        profile: "strict",
        source: "sandboxd",
      },
      sandboxProfile: "strict",
    },
  ],
  "external-only": [
    {
      kind: "systemd-unit",
      origin: "external",
      unitName: "sshd.service",
      unitType: "service",
      state: "active",
      slice: "system.slice",
      labels: {
        source: "host",
      },
    },
  ],
  empty: [],
};

interface CreateFixtureMetadataSourceOptions {
  defaultFixtureName?: ManagedEntityFixtureName;
}

const fixtureNameSchema = z.enum(managedEntityFixtureNames);

export function createFixtureMetadataSource(
  options: CreateFixtureMetadataSourceOptions = {},
): ManagedEntityMetadataSourcePort {
  const defaultFixtureName = options.defaultFixtureName ?? "mixed";

  return {
    async listFallbackEntities({ fixtureName = defaultFixtureName } = {}) {
      return managedEntityFixtures[fixtureName].map((entity) => ({
        ...entity,
        labels: { ...entity.labels },
      }));
    },
  };
}

export function parseFixtureName(value: string | undefined): ManagedEntityFixtureName | undefined {
  if (!value) {
    return undefined;
  }

  return fixtureNameSchema.parse(value);
}
