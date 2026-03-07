import { expect, test } from "vitest";
import { createFixtureMetadataSource, parseFixtureName } from "./fixture-source";

test("returns the mixed fallback fixture by default", async () => {
  const source = createFixtureMetadataSource();

  await expect(source.listFallbackEntitySummaries()).resolves.toMatchObject([
    { unitName: "docker.service" },
    { unitName: "lab-api.service" },
  ]);
});

test("returns a named fixture scenario", async () => {
  const source = createFixtureMetadataSource();

  await expect(
    source.listFallbackEntitySummaries({ fixtureName: "external-only" }),
  ).resolves.toMatchObject([{ unitName: "sshd.service", origin: "external" }]);
});

test("creates a fallback sandbox service", async () => {
  const source = createFixtureMetadataSource({ defaultFixtureName: "empty" });

  await expect(
    source.createFallbackSandboxService({
      name: "lab-worker",
      execStart: "/usr/bin/python worker.py",
    }),
  ).resolves.toMatchObject({
    unitName: "lab-worker.service",
    origin: "sandboxd",
    state: "inactive",
  });
});

test("parses a valid fixture name from the environment", () => {
  expect(parseFixtureName("mixed")).toBe("mixed");
  expect(parseFixtureName(undefined)).toBeUndefined();
});

test("rejects an unknown fixture name", () => {
  expect(() => parseFixtureName("broken")).toThrow(/Invalid option/i);
});
