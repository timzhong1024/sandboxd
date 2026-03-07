import type { ManagedEntityDetail } from "@sandboxd/core";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { createInspectManagedEntity } from "./inspect-managed-entity";

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
    try {
      await systemdRuntime.stopUnit(unitName);
      return inspectManagedEntity(unitName);
    } catch {
      const fallbackEntity = await metadataSource.updateFallbackEntityState(unitName, "inactive");
      if (!fallbackEntity) {
        throw new Error(`Managed entity not found: ${unitName}`);
      }

      return fallbackEntity;
    }
  };
}
