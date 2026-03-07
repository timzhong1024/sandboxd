import type { ManagedEntityDetail } from "@sandboxd/core";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { createInspectManagedEntity } from "./inspect-managed-entity";
import { shouldFallbackToMetadata } from "./systemd-runtime-fallback";

interface CreateStartManagedEntityOptions {
  metadataSource: ManagedEntityMetadataSourcePort;
  systemdRuntime: SystemdRuntimePort;
}

export function createStartManagedEntity({
  metadataSource,
  systemdRuntime,
}: CreateStartManagedEntityOptions) {
  const inspectManagedEntity = createInspectManagedEntity({
    metadataSource,
    systemdRuntime,
  });

  return async function startManagedEntity(unitName: string): Promise<ManagedEntityDetail> {
    try {
      // Stage 1 keeps action routing minimal and does not enforce capabilities yet.
      // Known gap: callers can still invoke actions on entities whose contract says the action is unavailable.
      await systemdRuntime.startUnit(unitName);
      return await inspectManagedEntity(unitName);
    } catch (error: unknown) {
      if (!shouldFallbackToMetadata(error)) {
        throw error;
      }

      const fallbackEntity = await metadataSource.updateFallbackEntityState(unitName, "active");
      if (!fallbackEntity) {
        throw new Error(`Managed entity not found: ${unitName}`);
      }

      return fallbackEntity;
    }
  };
}
