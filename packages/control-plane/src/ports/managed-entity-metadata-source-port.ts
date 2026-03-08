import type {
  AdvancedProperties,
  CreateSandboxServiceInput,
  DangerousAdoptManagedEntityInput,
  ManagedEntityDetail,
  ManagedEntitySummary,
  ResourceControls,
  SandboxProfile,
  Sandboxing,
  UnknownSystemdDirective,
} from "@sandboxd/core";

export const managedEntityFixtureNames = ["mixed", "external-only", "empty"] as const;

export type ManagedEntityFixtureName = (typeof managedEntityFixtureNames)[number];

export interface ManagedEntityMetadataRecord {
  advancedProperties?: AdvancedProperties;
  description?: string;
  unknownSystemdDirectives?: UnknownSystemdDirective[];
  resourceControls: ResourceControls;
  sandboxProfile?: SandboxProfile;
  sandboxing: Sandboxing;
  slice?: string;
  unitName: string;
  workingDirectory?: string;
}

export interface ManagedEntityMetadataSourcePort {
  deleteManagedEntityMetadata(unitName: string): Promise<void>;
  dangerouslyAdoptFallbackEntity(
    unitName: string,
    input: DangerousAdoptManagedEntityInput,
  ): Promise<ManagedEntityDetail | null>;
  dangerouslyAdoptManagedEntity(
    unitName: string,
    input: DangerousAdoptManagedEntityInput,
  ): Promise<ManagedEntityMetadataRecord>;
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
  deleteFallbackSandboxService(unitName: string): Promise<boolean>;
  updateFallbackEntityState(unitName: string, state: string): Promise<ManagedEntityDetail | null>;
  updateFallbackSandboxService(
    unitName: string,
    input: CreateSandboxServiceInput,
  ): Promise<ManagedEntityDetail | null>;
  updateManagedEntityMetadata(
    unitName: string,
    input: CreateSandboxServiceInput,
  ): Promise<ManagedEntityMetadataRecord>;
}
