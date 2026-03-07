import type { ManagedEntity } from "@sandboxd/core";

export interface ManagedEntitiesClientPort {
  loadManagedEntities(): Promise<ManagedEntity[]>;
}
