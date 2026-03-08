import {
  type CreateSandboxServiceInput,
  type ManagedEntityDetail,
  validateManagedEntityConfig,
} from "@sandboxd/core";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { createInspectManagedEntity } from "./inspect-managed-entity";
import { ManagedEntityConflictError } from "./managed-entity-errors";
import { shouldFallbackToMetadata } from "./systemd-runtime-fallback";

interface CreateUpdateSandboxServiceOptions {
  metadataSource: ManagedEntityMetadataSourcePort;
  systemdRuntime: SystemdRuntimePort;
}

export function createUpdateSandboxService({
  metadataSource,
  systemdRuntime,
}: CreateUpdateSandboxServiceOptions) {
  const inspectManagedEntity = createInspectManagedEntity({
    metadataSource,
    systemdRuntime,
  });

  return async function updateSandboxService(
    unitName: string,
    input: CreateSandboxServiceInput,
  ): Promise<ManagedEntityDetail> {
    const entity = await inspectManagedEntity(unitName);
    const shouldRestart = entity.status.activeState === "active";
    if (entity.origin !== "sandboxd" || entity.kind !== "sandbox-service") {
      throw new ManagedEntityConflictError(`Managed entity cannot be updated: ${unitName}`);
    }

    if (entity.validation?.readonly) {
      throw new ManagedEntityConflictError(
        entity.validation.readonlyReasons[0] ?? `Managed entity cannot be updated: ${unitName}`,
      );
    }

    const validation = validateManagedEntityConfig(input);
    if (validation.errors.length > 0) {
      throw new ManagedEntityConflictError(
        validation.errors[0]?.message ?? "Invalid entity config",
      );
    }

    try {
      await systemdRuntime.updateSandboxService(unitName, input);
      await metadataSource.updateManagedEntityMetadata(unitName, input);
      if (shouldRestart) {
        await systemdRuntime.restartUnit(unitName);
      }
      return await inspectManagedEntity(unitName);
    } catch (error: unknown) {
      if (!shouldFallbackToMetadata(error)) {
        throw error;
      }

      const fallbackEntity = await metadataSource.updateFallbackSandboxService(unitName, input);
      if (!fallbackEntity) {
        throw new ManagedEntityConflictError(`Managed entity cannot be updated: ${unitName}`);
      }

      return fallbackEntity;
    }
  };
}
