import type { ManagedEntityDetail } from "@sandboxd/core";
import type { ManagedEntitiesClientPort } from "../ports/managed-entities-client-port";

interface CreateLoadManagedEntityOptions {
  client: ManagedEntitiesClientPort;
}

export function createLoadManagedEntity({ client }: CreateLoadManagedEntityOptions) {
  return async function loadManagedEntity(unitName: string): Promise<ManagedEntityDetail> {
    return client.loadManagedEntity(unitName);
  };
}
