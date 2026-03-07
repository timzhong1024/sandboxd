import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { createFilesystemMetadataSource } from "./filesystem-source";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { force: true, recursive: true })));
  tempDirs.length = 0;
});

test("persists and loads managed entity metadata", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "sandboxd-metadata-"));
  tempDirs.push(rootDir);
  const source = createFilesystemMetadataSource({ rootDir });

  await source.saveManagedEntityMetadata("lab-api.service", {
    name: "lab-api",
    execStart: "/usr/bin/node server.js",
    sandboxProfile: "strict",
    resourceControls: {
      cpuWeight: "200",
    },
    sandboxing: {
      noNewPrivileges: true,
    },
  });

  await expect(source.getManagedEntityMetadata("lab-api.service")).resolves.toMatchObject({
    unitName: "lab-api.service",
    sandboxProfile: "strict",
    resourceControls: {
      cpuWeight: "200",
    },
    sandboxing: {
      noNewPrivileges: true,
    },
  });
  await expect(source.listManagedEntityMetadata()).resolves.toMatchObject([
    {
      unitName: "lab-api.service",
    },
  ]);
});
