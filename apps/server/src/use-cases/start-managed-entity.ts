import type { ManagedEntityDetail } from "@sandboxd/core";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { createInspectManagedEntity } from "./inspect-managed-entity";

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
      await systemdRuntime.startUnit(unitName);
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
