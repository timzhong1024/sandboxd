import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { createInspectManagedEntity } from "./inspect-managed-entity";
import { ManagedEntityConflictError, ManagedEntityNotFoundError } from "./managed-entity-errors";
import { shouldFallbackToMetadata } from "./systemd-runtime-fallback";

interface CreateDeleteSandboxServiceOptions {
  metadataSource: ManagedEntityMetadataSourcePort;
  systemdRuntime: SystemdRuntimePort;
}

export function createDeleteSandboxService({
  metadataSource,
  systemdRuntime,
}: CreateDeleteSandboxServiceOptions) {
  const inspectManagedEntity = createInspectManagedEntity({
    metadataSource,
    systemdRuntime,
  });

  return async function deleteSandboxService(unitName: string): Promise<void> {
    const entity = await inspectManagedEntity(unitName);
    if (entity.origin !== "sandboxd" || entity.kind !== "sandbox-service") {
      throw new ManagedEntityConflictError(`Managed entity cannot be deleted: ${unitName}`);
    }

    try {
      await systemdRuntime.deleteSandboxService(unitName);
      await metadataSource.deleteManagedEntityMetadata(unitName);
      return;
    } catch (error: unknown) {
      if (!shouldFallbackToMetadata(error)) {
        throw error;
      }

      const deleted = await metadataSource.deleteFallbackSandboxService(unitName);
      if (!deleted) {
        throw new ManagedEntityNotFoundError(`Managed entity not found: ${unitName}`);
      }
    }
  };
}
