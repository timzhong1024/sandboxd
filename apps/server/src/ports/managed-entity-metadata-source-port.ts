import type { ManagedEntity } from "@sandboxd/core";

export const managedEntityFixtureNames = ["mixed", "external-only", "empty"] as const;

export type ManagedEntityFixtureName = (typeof managedEntityFixtureNames)[number];

export interface ManagedEntityMetadataSourcePort {
  listFallbackEntities(options?: {
    fixtureName?: ManagedEntityFixtureName;
  }): Promise<ManagedEntity[]>;
}
