import type { ManagedEntitySummary } from "@sandboxd/core";
import type { ManagedEntitiesClientPort } from "../ports/managed-entities-client-port";

interface CreateLoadManagedEntitiesOptions {
  client: ManagedEntitiesClientPort;
}

export function createLoadManagedEntities({ client }: CreateLoadManagedEntitiesOptions) {
  return async function loadManagedEntities(): Promise<ManagedEntitySummary[]> {
    return client.loadManagedEntities();
  };
}
