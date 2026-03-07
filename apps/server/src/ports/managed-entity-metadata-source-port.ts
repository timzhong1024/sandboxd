import type {
  CreateSandboxServiceInput,
  ManagedEntityDetail,
  ManagedEntitySummary,
  ResourceControls,
  Sandboxing,
} from "@sandboxd/core";

export const managedEntityFixtureNames = ["mixed", "external-only", "empty"] as const;

export type ManagedEntityFixtureName = (typeof managedEntityFixtureNames)[number];

export interface ManagedEntityMetadataRecord {
  description?: string;
  resourceControls: ResourceControls;
  sandboxProfile?: string;
  sandboxing: Sandboxing;
  slice?: string;
  unitName: string;
  workingDirectory?: string;
}

export interface ManagedEntityMetadataSourcePort {
  deleteManagedEntityMetadata(unitName: string): Promise<void>;
  getManagedEntityMetadata(unitName: string): Promise<ManagedEntityMetadataRecord | null>;
  listFallbackEntitySummaries(options?: {
    fixtureName?: ManagedEntityFixtureName;
  }): Promise<ManagedEntitySummary[]>;
  listManagedEntityMetadata(): Promise<ManagedEntityMetadataRecord[]>;
  saveManagedEntityMetadata(
    unitName: string,
    input: CreateSandboxServiceInput,
  ): Promise<ManagedEntityMetadataRecord>;
  getFallbackEntityDetail(
    unitName: string,
    options?: {
      fixtureName?: ManagedEntityFixtureName;
    },
  ): Promise<ManagedEntityDetail | null>;
  createFallbackSandboxService(input: CreateSandboxServiceInput): Promise<ManagedEntityDetail>;
  updateFallbackEntityState(unitName: string, state: string): Promise<ManagedEntityDetail | null>;
}
