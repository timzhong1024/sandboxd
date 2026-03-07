import type { CreateSandboxServiceInput, ManagedEntityDetail } from "@sandboxd/core";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";
import type { SystemdRuntimePort } from "../ports/systemd-runtime-port";
import { createInspectManagedEntity } from "./inspect-managed-entity";
import { shouldFallbackToMetadata } from "./systemd-runtime-fallback";

interface CreateCreateSandboxServiceOptions {
  metadataSource: ManagedEntityMetadataSourcePort;
  systemdRuntime: SystemdRuntimePort;
}

export function createCreateSandboxService({
  metadataSource,
  systemdRuntime,
}: CreateCreateSandboxServiceOptions) {
  const inspectManagedEntity = createInspectManagedEntity({
    metadataSource,
    systemdRuntime,
  });

  return async function createSandboxService(
    input: CreateSandboxServiceInput,
  ): Promise<ManagedEntityDetail> {
    const unitName = input.name.endsWith(".service") ? input.name : `${input.name}.service`;

    try {
      await metadataSource.saveManagedEntityMetadata(unitName, input);
      try {
        await systemdRuntime.createSandboxService(unitName, input);
      } catch (error: unknown) {
        await metadataSource.deleteManagedEntityMetadata(unitName);
        throw error;
      }

      return await inspectManagedEntity(unitName);
    } catch (error: unknown) {
      if (!shouldFallbackToMetadata(error)) {
        throw error;
      }

      return metadataSource.createFallbackSandboxService(input);
    }
  };
}
