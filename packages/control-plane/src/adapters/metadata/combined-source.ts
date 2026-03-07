import type {
  CreateSandboxServiceInput,
  DangerousAdoptManagedEntityInput,
  ManagedEntityDetail,
  ManagedEntitySummary,
} from "@sandboxd/core";
import type {
  ManagedEntityFixtureName,
  ManagedEntityMetadataRecord,
  ManagedEntityMetadataSourcePort,
} from "../../ports/managed-entity-metadata-source-port";

interface CreateCombinedMetadataSourceOptions {
  fallbackSource: Pick<
    ManagedEntityMetadataSourcePort,
    | "createFallbackSandboxService"
    | "dangerouslyAdoptFallbackEntity"
    | "getFallbackEntityDetail"
    | "listFallbackEntitySummaries"
    | "updateFallbackEntityState"
  >;
  managedEntitySource: Pick<
    ManagedEntityMetadataSourcePort,
    | "deleteManagedEntityMetadata"
    | "dangerouslyAdoptManagedEntity"
    | "getManagedEntityMetadata"
    | "listManagedEntityMetadata"
    | "saveManagedEntityMetadata"
  >;
}

export function createCombinedMetadataSource({
  fallbackSource,
  managedEntitySource,
}: CreateCombinedMetadataSourceOptions): ManagedEntityMetadataSourcePort {
  return {
    async createFallbackSandboxService(
      input: CreateSandboxServiceInput,
    ): Promise<ManagedEntityDetail> {
      return fallbackSource.createFallbackSandboxService(input);
    },
    async dangerouslyAdoptFallbackEntity(
      unitName: string,
      input: DangerousAdoptManagedEntityInput,
    ): Promise<ManagedEntityDetail | null> {
      return fallbackSource.dangerouslyAdoptFallbackEntity(unitName, input);
    },
    async dangerouslyAdoptManagedEntity(unitName: string, input: DangerousAdoptManagedEntityInput) {
      return managedEntitySource.dangerouslyAdoptManagedEntity(unitName, input);
    },
    async deleteManagedEntityMetadata(unitName: string): Promise<void> {
      return managedEntitySource.deleteManagedEntityMetadata(unitName);
    },
    async getFallbackEntityDetail(
      unitName: string,
      options?: { fixtureName?: ManagedEntityFixtureName },
    ): Promise<ManagedEntityDetail | null> {
      return fallbackSource.getFallbackEntityDetail(unitName, options);
    },
    async getManagedEntityMetadata(unitName: string): Promise<ManagedEntityMetadataRecord | null> {
      return managedEntitySource.getManagedEntityMetadata(unitName);
    },
    async listFallbackEntitySummaries(options?: {
      fixtureName?: ManagedEntityFixtureName;
    }): Promise<ManagedEntitySummary[]> {
      return fallbackSource.listFallbackEntitySummaries(options);
    },
    async listManagedEntityMetadata(): Promise<ManagedEntityMetadataRecord[]> {
      return managedEntitySource.listManagedEntityMetadata();
    },
    async saveManagedEntityMetadata(
      unitName: string,
      input: CreateSandboxServiceInput,
    ): Promise<ManagedEntityMetadataRecord> {
      return managedEntitySource.saveManagedEntityMetadata(unitName, input);
    },
    async updateFallbackEntityState(
      unitName: string,
      state: string,
    ): Promise<ManagedEntityDetail | null> {
      return fallbackSource.updateFallbackEntityState(unitName, state);
    },
  };
}
