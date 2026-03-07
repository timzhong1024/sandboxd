import {
  mapSystemdUnitDetailRecord,
  mapSystemdUnitRecord,
  type ManagedEntitySummary,
} from "@sandboxd/core";
import type {
  ManagedEntityFixtureName,
  ManagedEntityMetadataSourcePort,
} from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { createSummaryFromMetadata, mergeSummaryWithMetadata } from "./managed-entity-metadata";
import { shouldFallbackToMetadata } from "./systemd-runtime-fallback";

interface CreateListManagedEntitiesOptions {
  metadataSource: ManagedEntityMetadataSourcePort;
  systemdRuntime: SystemdRuntimePort;
}

interface ListManagedEntitiesOptions {
  fixtureName?: ManagedEntityFixtureName;
}

export function createListManagedEntities({
  metadataSource,
  systemdRuntime,
}: CreateListManagedEntitiesOptions) {
  return async function listManagedEntities(
    options: ListManagedEntitiesOptions = {},
  ): Promise<ManagedEntitySummary[]> {
    if (options.fixtureName) {
      return metadataSource.listFallbackEntitySummaries({ fixtureName: options.fixtureName });
    }

    try {
      const [records, managedMetadata] = await Promise.all([
        systemdRuntime.listUnits(),
        metadataSource.listManagedEntityMetadata(),
      ]);
      const metadataByUnitName = new Map(
        managedMetadata.map((metadata) => [metadata.unitName, metadata] as const),
      );
      if (records.length === 0 && managedMetadata.length === 0) {
        return metadataSource.listFallbackEntitySummaries();
      }
      const summaries = records.map((record) =>
        mergeSummaryWithMetadata(
          mapSystemdUnitRecord(record),
          metadataByUnitName.get(record.unitName) ?? null,
        ),
      );
      const knownUnitNames = new Set(summaries.map((summary) => summary.unitName));

      const missingSummaries = await Promise.all(
        managedMetadata
          .filter((metadata) => !knownUnitNames.has(metadata.unitName))
          .map(async (metadata) => {
            const detailRecord = await systemdRuntime.getUnit(metadata.unitName);
            if (detailRecord) {
              return mergeSummaryWithMetadata(mapSystemdUnitDetailRecord(detailRecord), metadata);
            }

            return createSummaryFromMetadata(metadata);
          }),
      );

      return [...summaries, ...missingSummaries].sort((left, right) =>
        left.unitName.localeCompare(right.unitName),
      );
    } catch (error: unknown) {
      if (!shouldFallbackToMetadata(error)) {
        throw error;
      }
    }

    return metadataSource.listFallbackEntitySummaries();
  };
}
