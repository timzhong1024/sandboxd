import type { ManagedEntity } from "@sandboxd/core";
import type { ManagedEntitiesClientPort } from "../ports/managed-entities-client-port";

interface CreateLoadManagedEntitiesOptions {
  client: ManagedEntitiesClientPort;
}

export function createLoadManagedEntities({ client }: CreateLoadManagedEntitiesOptions) {
  return async function loadManagedEntities(): Promise<ManagedEntity[]> {
    return client.loadManagedEntities();
  };
}
