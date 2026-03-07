import type { CreateSandboxServiceInput, ManagedEntityDetail } from "@sandboxd/core";
import type { ManagedEntityMetadataSourcePort } from "../ports/managed-entity-metadata-source-port";

interface CreateCreateSandboxServiceOptions {
  metadataSource: ManagedEntityMetadataSourcePort;
}

export function createCreateSandboxService({ metadataSource }: CreateCreateSandboxServiceOptions) {
  return async function createSandboxService(
    input: CreateSandboxServiceInput,
  ): Promise<ManagedEntityDetail> {
    return metadataSource.createFallbackSandboxService(input);
  };
}
