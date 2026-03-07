import { createServer } from "node:http";
import type { ManagedEntity } from "@sandboxd/core";

interface CreateAppOptions {
  listManagedEntities: () => Promise<ManagedEntity[]>;
}

export function createApp({ listManagedEntities }: CreateAppOptions) {
  return createServer(async (request, response) => {
    if (request.url === "/healthz") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (request.url === "/api/entities") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(await listManagedEntities()));
      return;
    }

    response.statusCode = 404;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Not Found" }));
  });
}
