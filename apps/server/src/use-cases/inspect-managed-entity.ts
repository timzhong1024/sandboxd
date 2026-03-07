import { mapSystemdUnitDetailRecord, type ManagedEntityDetail } from "@sandboxd/core";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";

interface CreateInspectManagedEntityOptions {
  metadataSource: ManagedEntityMetadataSourcePort;
  systemdRuntime: SystemdRuntimePort;
}

export function createInspectManagedEntity({
  metadataSource,
  systemdRuntime,
}: CreateInspectManagedEntityOptions) {
  return async function inspectManagedEntity(unitName: string): Promise<ManagedEntityDetail> {
    try {
      const record = await systemdRuntime.getUnit(unitName);
      if (record) {
        return mapSystemdUnitDetailRecord(record);
      }
    } catch {
      // Fall through to metadata source.
    }

    const fallbackEntity = await metadataSource.getFallbackEntityDetail(unitName);
    if (!fallbackEntity) {
      throw new Error(`Managed entity not found: ${unitName}`);
    }

    return fallbackEntity;
  };
}
