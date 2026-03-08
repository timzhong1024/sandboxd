import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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
    resourceControls: {},
    sandboxing: {},
  });
  await expect(source.listManagedEntityMetadata()).resolves.toMatchObject([
    {
      unitName: "lab-api.service",
    },
  ]);
});

test("dangerously adopts an existing unit through a sandboxd drop-in", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "sandboxd-metadata-"));
  tempDirs.push(rootDir);
  const source = createFilesystemMetadataSource({ rootDir });

  await source.dangerouslyAdoptManagedEntity("docker.service", {
    sandboxProfile: "baseline",
  });

  await expect(source.getManagedEntityMetadata("docker.service")).resolves.toMatchObject({
    unitName: "docker.service",
    sandboxProfile: "baseline",
  });
});

test("parses supported advanced properties and preserves unknown directives", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "sandboxd-metadata-"));
  tempDirs.push(rootDir);
  const source = createFilesystemMetadataSource({ rootDir });

  await writeFile(
    join(rootDir, "lab-api.service"),
    [
      "[Unit]",
      "Description=Sandboxd managed lab API",
      "",
      "[Service]",
      "ExecStart=/usr/bin/node server.js",
      "ProtectSystem=yes",
      "PrivateTmp=disconnected",
      "ReadOnlyPaths=/usr /etc",
      "PrivateDevices=yes",
      "SystemCallFilter=@system-service ~@privileged",
      "RestrictNamespaces=yes",
      'Environment=NODE_ENV=production "GREETING=hello world"',
      'Environment=BAD_TOKEN "unterminated',
      "IPAddressDeny=any",
      "",
    ].join("\n"),
  );
  await mkdir(join(rootDir, "lab-api.service.d"), { recursive: true });
  await writeFile(
    join(rootDir, "lab-api.service.d", "90-sandboxd-owned.conf"),
    ["[X-Sandboxd]", "Owned=yes", "Profile=strict", ""].join("\n"),
  );

  await expect(source.getManagedEntityMetadata("lab-api.service")).resolves.toMatchObject({
    unitName: "lab-api.service",
    sandboxProfile: "strict",
    advancedProperties: {
      ProtectSystem: {
        parsed: true,
      },
      PrivateTmp: {
        parsed: "disconnected",
      },
      ReadOnlyPaths: [
        {
          parsed: ["/usr", "/etc"],
        },
      ],
      PrivateDevices: {
        parsed: true,
      },
      SystemCallFilter: [
        {
          raw: "@system-service ~@privileged",
        },
      ],
      RestrictNamespaces: [
        {
          parsed: {
            mode: "boolean",
            value: true,
          },
        },
      ],
      Environment: [
        {
          parsed: {
            NODE_ENV: "production",
            GREETING: "hello world",
          },
        },
        {
          raw: 'BAD_TOKEN "unterminated',
        },
      ],
    },
    unknownSystemdDirectives: [
      {
        section: "Service",
        key: "IPAddressDeny",
        value: "any",
        source: "unit-file",
      },
    ],
  });
});

test("ignores legacy unknown profile values instead of failing metadata reads", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "sandboxd-metadata-"));
  tempDirs.push(rootDir);
  const source = createFilesystemMetadataSource({ rootDir });

  await mkdir(join(rootDir, "lab-legacy.service.d"), { recursive: true });
  await writeFile(
    join(rootDir, "lab-legacy.service.d", "90-sandboxd-owned.conf"),
    ["[X-Sandboxd]", "Owned=yes", "Profile=custom-legacy", ""].join("\n"),
  );

  await expect(source.getManagedEntityMetadata("lab-legacy.service")).resolves.toMatchObject({
    unitName: "lab-legacy.service",
  });
  await expect(source.getManagedEntityMetadata("lab-legacy.service")).resolves.not.toHaveProperty(
    "sandboxProfile",
  );
});
