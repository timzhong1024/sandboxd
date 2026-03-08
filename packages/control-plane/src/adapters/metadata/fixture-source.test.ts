import { expect, test } from "vitest";
import { createFixtureMetadataSource, parseFixtureName } from "./fixture-source";

test("returns the mixed fallback fixture by default", async () => {
  const source = createFixtureMetadataSource();

  await expect(source.listFallbackEntitySummaries()).resolves.toMatchObject([
    {
      unitName: "docker.service",
      resourceControls: {
        cpuWeight: "150",
        memoryMax: "1G",
      },
    },
    {
      unitName: "lab-api.service",
      sandboxProfile: "strict",
      resourceControls: {
        cpuWeight: "200",
        memoryMax: "512M",
      },
    },
    {
      unitName: "lab-worker.service",
      sandboxProfile: "baseline",
      resourceControls: {
        cpuWeight: "350",
        memoryMax: "2G",
      },
    },
    {
      unitName: "lab-batch.service",
      state: "failed",
      sandboxProfile: "strict",
      resourceControls: {
        cpuWeight: "120",
        memoryMax: "768M",
      },
    },
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
