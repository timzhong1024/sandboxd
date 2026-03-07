import { parseManagedEntities, type ManagedEntity } from "@sandboxd/core";
import type { ManagedEntitiesClientPort } from "../../ports/managed-entities-client-port";

export function createManagedEntitiesHttpClient(): ManagedEntitiesClientPort {
  return {
    async loadManagedEntities(): Promise<ManagedEntity[]> {
      const response = await fetch("/api/entities");
      if (!response.ok) {
        throw new Error(`Failed to load entities: ${response.status}`);
      }

      return parseManagedEntities(await response.json());
    },
  };
}
