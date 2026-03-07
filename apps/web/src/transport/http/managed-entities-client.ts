import {
  parseCreateSandboxServiceInput,
  parseManagedEntityDetail,
  parseManagedEntitySummaries,
  type CreateSandboxServiceInput,
  type ManagedEntityDetail,
  type ManagedEntitySummary,
} from "@sandboxd/core";
import type { ManagedEntitiesClientPort } from "../../ports/managed-entities-client-port";

export function createManagedEntitiesHttpClient(): ManagedEntitiesClientPort {
  return {
    async loadManagedEntities(): Promise<ManagedEntitySummary[]> {
      const response = await fetch("/api/entities");
      assertOk(response, "Failed to load entities");
      return parseManagedEntitySummaries(await response.json());
    },
    async loadManagedEntity(unitName: string): Promise<ManagedEntityDetail> {
      const response = await fetch(`/api/entities/${encodeURIComponent(unitName)}`);
      assertOk(response, `Failed to load entity: ${unitName}`);
      return parseManagedEntityDetail(await response.json());
    },
    async startManagedEntity(unitName: string): Promise<ManagedEntityDetail> {
      return postEntityAction(unitName, "start");
    },
    async stopManagedEntity(unitName: string): Promise<ManagedEntityDetail> {
      return postEntityAction(unitName, "stop");
    },
    async restartManagedEntity(unitName: string): Promise<ManagedEntityDetail> {
      return postEntityAction(unitName, "restart");
    },
    async createSandboxService(input: CreateSandboxServiceInput): Promise<ManagedEntityDetail> {
      const validatedInput = parseCreateSandboxServiceInput(input);
      const response = await fetch("/api/sandbox-services", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(validatedInput),
      });
      assertOk(response, "Failed to create sandbox service");
      return parseManagedEntityDetail(await response.json());
    },
  };
}

async function postEntityAction(
  unitName: string,
  action: "start" | "stop" | "restart",
): Promise<ManagedEntityDetail> {
  const response = await fetch(`/api/entities/${encodeURIComponent(unitName)}/${action}`, {
    method: "POST",
  });
  assertOk(response, `Failed to ${action} entity: ${unitName}`);
  return parseManagedEntityDetail(await response.json());
}

function assertOk(response: Response, message: string) {
  if (!response.ok) {
    throw new Error(`${message}: ${response.status}`);
  }
}
