import { once } from "node:events";
import { afterEach, expect, test, vi } from "vitest";
import { createApp } from "./create-app";

const servers = new Set<ReturnType<typeof createApp>>();

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
  const listManagedEntities = vi.fn().mockResolvedValue([
    {
      unitName: "docker.service",
      kind: "systemd-unit",
      origin: "external",
      unitType: "service",
      state: "active",
      labels: {},
    },
    {
      unitName: "lab-api.service",
      kind: "sandbox-service",
      origin: "sandboxd",
      unitType: "service",
      state: "active",
      labels: {},
    },
  ]);
  const server = createApp({ listManagedEntities });
  servers.add(server);
  server.listen(0, "127.0.0.1");
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

test("returns healthz status", async () => {
  const server = createApp({ listManagedEntities: vi.fn().mockResolvedValue([]) });
  servers.add(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new TypeError("Expected an ephemeral TCP port");
  }

  const response = await fetch(`http://127.0.0.1:${address.port}/healthz`);

  expect(response.ok).toBe(true);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});
