import type { ManagedEntityDetail } from "@sandboxd/core";
import type { ManagedEntitiesClientPort } from "../ports/managed-entities-client-port";

interface CreateManagedEntityActionOptions {
  client: ManagedEntitiesClientPort;
}

export function createStartManagedEntity({ client }: CreateManagedEntityActionOptions) {
  return async function startManagedEntity(unitName: string): Promise<ManagedEntityDetail> {
    return client.startManagedEntity(unitName);
  };
}

export function createStopManagedEntity({ client }: CreateManagedEntityActionOptions) {
  return async function stopManagedEntity(unitName: string): Promise<ManagedEntityDetail> {
    return client.stopManagedEntity(unitName);
  };
}

export function createRestartManagedEntity({ client }: CreateManagedEntityActionOptions) {
  return async function restartManagedEntity(unitName: string): Promise<ManagedEntityDetail> {
    return client.restartManagedEntity(unitName);
  };
}
