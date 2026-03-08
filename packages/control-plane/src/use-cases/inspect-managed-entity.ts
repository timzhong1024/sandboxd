import {
  enrichManagedEntityDetail,
  mapSystemdUnitDetailRecord,
  type ManagedEntityDetail,
} from "@sandboxd/core";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { mergeDetailWithMetadata } from "./managed-entity-metadata";
import { ManagedEntityNotFoundError } from "./managed-entity-errors";
import { shouldFallbackToMetadata } from "./systemd-runtime-fallback";

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
        const metadata = await metadataSource.getManagedEntityMetadata(unitName);
        return mergeDetailWithMetadata(mapSystemdUnitDetailRecord(record), metadata);
      }
    } catch (error: unknown) {
      if (!shouldFallbackToMetadata(error)) {
        throw error;
      }

      const fallbackEntity = await metadataSource.getFallbackEntityDetail(unitName);
      if (!fallbackEntity) {
        throw new ManagedEntityNotFoundError(`Managed entity not found: ${unitName}`);
      }

      return enrichManagedEntityDetail(fallbackEntity);
    }

    throw new ManagedEntityNotFoundError(`Managed entity not found: ${unitName}`);
  };
}
