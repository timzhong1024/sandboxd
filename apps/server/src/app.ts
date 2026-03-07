import { createServer } from "node:http";
import { sampleEntities } from "./entities";

export function buildApp() {
  return createServer((request, response) => {
    if (request.url === "/healthz") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (request.url === "/api/entities") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(sampleEntities));
      return;
    }

    response.statusCode = 404;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Not Found" }));
  });
}
