import { afterEach, expect, test, vi } from "vitest";
import { createManagedEntitiesHttpClient } from "./managed-entities-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("loads and parses managed entities from the API", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          kind: "systemd-unit",
          origin: "external",
          unitName: "docker.service",
          unitType: "service",
          state: "active",
          labels: {},
        },
      ],
    }),
  );

  const client = createManagedEntitiesHttpClient();

  await expect(client.loadManagedEntities()).resolves.toMatchObject([
    { unitName: "docker.service" },
  ]);
});

test("surfaces API failures", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }),
  );

  const client = createManagedEntitiesHttpClient();

  await expect(client.loadManagedEntities()).rejects.toThrow(/503/);
});
