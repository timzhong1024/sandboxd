import { expect, test } from "vitest";
import { createFixtureMetadataSource, parseFixtureName } from "./fixture-source";

test("returns the mixed fallback fixture by default", async () => {
  const source = createFixtureMetadataSource();

  await expect(source.listFallbackEntities()).resolves.toMatchObject([
    { unitName: "docker.service" },
    { unitName: "lab-api.service" },
  ]);
});

test("returns a named fixture scenario", async () => {
  const source = createFixtureMetadataSource();

  await expect(
    source.listFallbackEntities({ fixtureName: "external-only" }),
  ).resolves.toMatchObject([{ unitName: "sshd.service", origin: "external" }]);
});

test("parses a valid fixture name from the environment", () => {
  expect(parseFixtureName("mixed")).toBe("mixed");
  expect(parseFixtureName(undefined)).toBeUndefined();
});

test("rejects an unknown fixture name", () => {
  expect(() => parseFixtureName("broken")).toThrow(/Unknown entity fixture/i);
});
