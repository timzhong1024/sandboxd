import { createServer } from "node:http";
import type { ManagedEntityFixtureName } from "@sandboxd/core";
import { listEntities } from "./entities";

interface BuildAppOptions {
  fixtureName?: ManagedEntityFixtureName;
}

export function buildApp(options: BuildAppOptions = {}) {
  return createServer(async (request, response) => {
    if (request.url === "/healthz") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (request.url === "/api/entities") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(await listEntities(options.fixtureName)));
      return;
    }

    response.statusCode = 404;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Not Found" }));
  });
}
