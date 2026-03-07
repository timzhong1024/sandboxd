import type { ManagedEntityDetail } from "@sandboxd/core";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { createInspectManagedEntity } from "./inspect-managed-entity";
import { ManagedEntityConflictError } from "./managed-entity-errors";
import { shouldFallbackToMetadata } from "./systemd-runtime-fallback";

interface CreateStopManagedEntityOptions {
  metadataSource: ManagedEntityMetadataSourcePort;
  systemdRuntime: SystemdRuntimePort;
}

export function createStopManagedEntity({
  metadataSource,
  systemdRuntime,
}: CreateStopManagedEntityOptions) {
  const inspectManagedEntity = createInspectManagedEntity({
    metadataSource,
    systemdRuntime,
  });

  return async function stopManagedEntity(unitName: string): Promise<ManagedEntityDetail> {
    const entity = await inspectManagedEntity(unitName);
    if (!entity.capabilities.canStop) {
      throw new ManagedEntityConflictError(`Managed entity cannot be stopped: ${unitName}`);
    }

    try {
      await systemdRuntime.stopUnit(unitName);
      return await inspectManagedEntity(unitName);
    } catch (error: unknown) {
      if (!shouldFallbackToMetadata(error)) {
        throw error;
      }

      const fallbackEntity = await metadataSource.updateFallbackEntityState(unitName, "inactive");
      if (!fallbackEntity) {
        throw new Error(`Managed entity not found: ${unitName}`);
      }

      return fallbackEntity;
    }
  };
}
