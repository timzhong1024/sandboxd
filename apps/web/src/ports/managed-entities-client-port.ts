import type {
  CreateSandboxServiceInput,
  ManagedEntityDetail,
  ManagedEntitySummary,
} from "@sandboxd/core";

export interface ManagedEntitiesClientPort {
  loadManagedEntities(): Promise<ManagedEntitySummary[]>;
  loadManagedEntity(unitName: string): Promise<ManagedEntityDetail>;
  startManagedEntity(unitName: string): Promise<ManagedEntityDetail>;
  stopManagedEntity(unitName: string): Promise<ManagedEntityDetail>;
  restartManagedEntity(unitName: string): Promise<ManagedEntityDetail>;
  createSandboxService(input: CreateSandboxServiceInput): Promise<ManagedEntityDetail>;
  updateSandboxService(
    unitName: string,
    input: CreateSandboxServiceInput,
  ): Promise<ManagedEntityDetail>;
  deleteSandboxService(unitName: string): Promise<void>;
}
