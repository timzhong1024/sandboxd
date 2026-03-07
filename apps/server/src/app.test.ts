import { once } from "node:events";
import { afterEach, expect, test } from "vitest";
import { buildApp } from "./app";

const servers = new Set<ReturnType<typeof buildApp>>();

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        }),
    ),
  );
  servers.clear();
});

test("returns entities through the API", async () => {
  const server = buildApp();
  servers.add(server);
  server.listen(0);
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new TypeError("Expected an ephemeral TCP port");
  }

  const response = await fetch(`http://127.0.0.1:${address.port}/api/entities`);

  expect(response.ok).toBe(true);
  expect(await response.json()).toMatchObject([
    { unitName: "docker.service" },
    { unitName: "lab-api.service" },
  ]);
});
