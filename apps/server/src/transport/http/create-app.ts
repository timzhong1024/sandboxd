import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import {
  parseCreateSandboxServiceInput,
  parseManagedEntityDetail,
  parseManagedEntitySummaries,
  type CreateSandboxServiceInput,
  type ManagedEntityDetail,
  type ManagedEntitySummary,
} from "@sandboxd/core";
import { ZodError } from "zod";

interface CreateAppOptions {
  listManagedEntities: () => Promise<ManagedEntitySummary[]>;
  inspectManagedEntity: (unitName: string) => Promise<ManagedEntityDetail>;
  startManagedEntity: (unitName: string) => Promise<ManagedEntityDetail>;
  stopManagedEntity: (unitName: string) => Promise<ManagedEntityDetail>;
  restartManagedEntity: (unitName: string) => Promise<ManagedEntityDetail>;
  createSandboxService: (input: CreateSandboxServiceInput) => Promise<ManagedEntityDetail>;
}

export function createApp({
  listManagedEntities,
  inspectManagedEntity,
  startManagedEntity,
  stopManagedEntity,
  restartManagedEntity,
  createSandboxService,
}: CreateAppOptions) {
  return createServer(async (request, response) => {
    try {
      if (request.url === "/healthz") {
        sendJson(response, 200, { status: "ok" });
        return;
      }

      const url = new URL(request.url ?? "/", "http://localhost");

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

      if (error instanceof Error && /not found/i.test(error.message)) {
        sendJson(response, 404, { error: error.message });
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

  // Stage 1 leaves malformed JSON on the generic 500 path to keep the transport thin.
  // Known gap: this should become a 400 once request validation/error mapping is tightened.
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
