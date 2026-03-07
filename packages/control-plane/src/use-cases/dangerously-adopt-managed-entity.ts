import {
  getUnitType,
  type DangerousAdoptManagedEntityInput,
  type ManagedEntityDetail,
} from "@sandboxd/core";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { ManagedEntityConflictError, ManagedEntityNotFoundError } from "./managed-entity-errors";
import { createInspectManagedEntity } from "./inspect-managed-entity";
import { shouldFallbackToMetadata } from "./systemd-runtime-fallback";

interface CreateDangerouslyAdoptManagedEntityOptions {
  metadataSource: ManagedEntityMetadataSourcePort;
  systemdRuntime: SystemdRuntimePort;
}

export function createDangerouslyAdoptManagedEntity({
  metadataSource,
  systemdRuntime,
}: CreateDangerouslyAdoptManagedEntityOptions) {
  const inspectManagedEntity = createInspectManagedEntity({
    metadataSource,
    systemdRuntime,
  });

  return async function dangerouslyAdoptManagedEntity(
    unitName: string,
    input: DangerousAdoptManagedEntityInput,
  ): Promise<ManagedEntityDetail> {
    const existingMetadata = await metadataSource.getManagedEntityMetadata(unitName);
    if (existingMetadata) {
      throw new ManagedEntityConflictError(`Managed entity is already sandboxd-owned: ${unitName}`);
    }

    try {
      const runtimeRecord = await systemdRuntime.getUnit(unitName);
      if (!runtimeRecord) {
        throw new ManagedEntityNotFoundError(`Managed entity not found: ${unitName}`);
      }

      if (getUnitType(unitName) !== "service") {
        throw new ManagedEntityConflictError(
          `Dangerous adopt only supports existing service units: ${unitName}`,
        );
      }

      await metadataSource.dangerouslyAdoptManagedEntity(unitName, input);

      try {
        await systemdRuntime.reloadSystemd();
      } catch (error: unknown) {
        await metadataSource.deleteManagedEntityMetadata(unitName);
        throw error;
      }

      return await inspectManagedEntity(unitName);
    } catch (error: unknown) {
      if (!shouldFallbackToMetadata(error)) {
        throw error;
      }

      const fallbackEntity = await metadataSource.dangerouslyAdoptFallbackEntity(unitName, input);
      if (!fallbackEntity) {
        throw new ManagedEntityNotFoundError(`Managed entity not found: ${unitName}`);
      }

      return fallbackEntity;
    }
  };
}
