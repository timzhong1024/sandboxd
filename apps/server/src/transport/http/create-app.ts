import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import {
  parseCreateSandboxServiceInput,
  parseDangerousAdoptManagedEntityInput,
  parseManagedEntityDetail,
  parseManagedEntitySummaries,
  type CreateSandboxServiceInput,
  type DangerousAdoptManagedEntityInput,
  type ManagedEntityDetail,
  type ManagedEntitySummary,
} from "@sandboxd/core";
import { ZodError } from "zod";
import { ManagedEntityConflictError, ManagedEntityNotFoundError } from "@sandboxd/control-plane";

class InvalidJsonBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidJsonBodyError";
  }
}

interface CreateAppOptions {
  handleMcpRequest?: (request: IncomingMessage, response: ServerResponse) => Promise<boolean>;
  listManagedEntities: () => Promise<ManagedEntitySummary[]>;
  inspectManagedEntity: (unitName: string) => Promise<ManagedEntityDetail>;
  startManagedEntity: (unitName: string) => Promise<ManagedEntityDetail>;
  stopManagedEntity: (unitName: string) => Promise<ManagedEntityDetail>;
  restartManagedEntity: (unitName: string) => Promise<ManagedEntityDetail>;
  dangerouslyAdoptManagedEntity: (
    unitName: string,
    input: DangerousAdoptManagedEntityInput,
  ) => Promise<ManagedEntityDetail>;
  createSandboxService: (input: CreateSandboxServiceInput) => Promise<ManagedEntityDetail>;
}

export function createApp({
  handleMcpRequest,
  listManagedEntities,
  inspectManagedEntity,
  startManagedEntity,
  stopManagedEntity,
  restartManagedEntity,
  dangerouslyAdoptManagedEntity,
  createSandboxService,
}: CreateAppOptions) {
  return createServer(async (request, response) => {
    try {
      if (request.url === "/healthz") {
        sendJson(response, 200, { status: "ok" });
        return;
      }

      const url = new URL(request.url ?? "/", "http://localhost");

      if (url.pathname === "/mcp" && handleMcpRequest) {
        if (await handleMcpRequest(request, response)) {
          return;
        }
      }

      if (request.method === "GET" && url.pathname === "/api/entities") {
        sendJson(response, 200, parseManagedEntitySummaries(await listManagedEntities()));
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/entities/")) {
        const unitName = decodeURIComponent(url.pathname.slice("/api/entities/".length));
        sendJson(response, 200, parseManagedEntityDetail(await inspectManagedEntity(unitName)));
        return;
      }

      const entityActionMatch =
        /^\/api\/entities\/(?<unitName>[^/]+)\/(?<action>start|stop|restart)$/.exec(url.pathname);
      if (request.method === "POST" && entityActionMatch?.groups) {
        const { unitName: encodedUnitName, action: matchedAction } = entityActionMatch.groups;
        if (!encodedUnitName || !matchedAction) {
          sendJson(response, 400, { error: "Invalid entity action path" });
          return;
        }

        const unitName = decodeURIComponent(encodedUnitName);
        const handlers = {
          restart: restartManagedEntity,
          start: startManagedEntity,
          stop: stopManagedEntity,
        } as const;
        const action = matchedAction as keyof typeof handlers;

        sendJson(response, 200, parseManagedEntityDetail(await handlers[action](unitName)));
        return;
      }

      const dangerousAdoptMatch = /^\/api\/entities\/(?<unitName>[^/]+)\/dangerous-adopt$/.exec(
        url.pathname,
      );
      if (request.method === "POST" && dangerousAdoptMatch?.groups) {
        const encodedUnitName = dangerousAdoptMatch.groups.unitName;
        if (!encodedUnitName) {
          sendJson(response, 400, { error: "Invalid dangerous adopt path" });
          return;
        }

        const unitName = decodeURIComponent(encodedUnitName);
        const body = await readJsonBody(request);
        const input = parseDangerousAdoptManagedEntityInput(body);
        sendJson(
          response,
          200,
          parseManagedEntityDetail(await dangerouslyAdoptManagedEntity(unitName, input)),
        );
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/sandbox-services") {
        const body = await readJsonBody(request);
        const input = parseCreateSandboxServiceInput(body);
        sendJson(response, 201, parseManagedEntityDetail(await createSandboxService(input)));
        return;
      }

      sendJson(response, 404, { error: "Not Found" });
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        sendJson(response, 400, { error: error.message });
        return;
      }

      if (error instanceof ManagedEntityConflictError) {
        sendJson(response, 409, { error: error.message });
        return;
      }

      if (error instanceof ManagedEntityNotFoundError) {
        sendJson(response, 404, { error: error.message });
        return;
      }

      if (error instanceof InvalidJsonBodyError) {
        sendJson(response, 400, { error: error.message });
        return;
      }

      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Internal Server Error",
      });
    }
  });
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request: IncomingMessage) {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new InvalidJsonBodyError("Request body must be valid JSON");
  }
}
