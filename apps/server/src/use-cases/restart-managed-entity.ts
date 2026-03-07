import type { ManagedEntityDetail } from "@sandboxd/core";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { createInspectManagedEntity } from "./inspect-managed-entity";

interface CreateRestartManagedEntityOptions {
  metadataSource: ManagedEntityMetadataSourcePort;
  systemdRuntime: SystemdRuntimePort;
}

export function createRestartManagedEntity({
  metadataSource,
  systemdRuntime,
}: CreateRestartManagedEntityOptions) {
  const inspectManagedEntity = createInspectManagedEntity({
    metadataSource,
    systemdRuntime,
  });

  return async function restartManagedEntity(unitName: string): Promise<ManagedEntityDetail> {
    try {
      await systemdRuntime.restartUnit(unitName);
      return inspectManagedEntity(unitName);
    } catch {
      const fallbackEntity = await metadataSource.updateFallbackEntityState(unitName, "active");
      if (!fallbackEntity) {
        throw new Error(`Managed entity not found: ${unitName}`);
      }

      return fallbackEntity;
    }
  };
}
