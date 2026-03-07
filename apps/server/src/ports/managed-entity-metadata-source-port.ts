import type {
  CreateSandboxServiceInput,
  ManagedEntityDetail,
  ManagedEntitySummary,
} from "@sandboxd/core";

export const managedEntityFixtureNames = ["mixed", "external-only", "empty"] as const;

export type ManagedEntityFixtureName = (typeof managedEntityFixtureNames)[number];

export interface ManagedEntityMetadataSourcePort {
  listFallbackEntitySummaries(options?: {
    fixtureName?: ManagedEntityFixtureName;
  }): Promise<ManagedEntitySummary[]>;
  getFallbackEntityDetail(
    unitName: string,
    options?: {
      fixtureName?: ManagedEntityFixtureName;
    },
  ): Promise<ManagedEntityDetail | null>;
  createFallbackSandboxService(input: CreateSandboxServiceInput): Promise<ManagedEntityDetail>;
  updateFallbackEntityState(unitName: string, state: string): Promise<ManagedEntityDetail | null>;
}
