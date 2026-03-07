import { mapSystemdUnitRecord, type ManagedEntity } from "@sandboxd/core";
import type {
  ManagedEntityFixtureName,
  ManagedEntityMetadataSourcePort,
} from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";

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
  ): Promise<ManagedEntity[]> {
    if (options.fixtureName) {
      return metadataSource.listFallbackEntities({ fixtureName: options.fixtureName });
    }

    try {
      const records = await systemdRuntime.listUnits();
      if (records.length > 0) {
        return records.map(mapSystemdUnitRecord);
      }
    } catch {
      // Fall through to metadata source.
    }

    return metadataSource.listFallbackEntities();
  };
}
