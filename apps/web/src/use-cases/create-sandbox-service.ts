import type { CreateSandboxServiceInput, ManagedEntityDetail } from "@sandboxd/core";
import type { ManagedEntitiesClientPort } from "../ports/managed-entities-client-port";

interface CreateCreateSandboxServiceOptions {
  client: ManagedEntitiesClientPort;
}

export function createCreateSandboxService({ client }: CreateCreateSandboxServiceOptions) {
  return async function createSandboxService(
    input: CreateSandboxServiceInput,
  ): Promise<ManagedEntityDetail> {
    return client.createSandboxService(input);
  };
}
