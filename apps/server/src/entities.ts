import {
  getManagedEntityFixture,
  mapSystemdUnitRecord,
  managedEntityFixtureNames,
  type SystemdUnitRecord,
  type ManagedEntity,
  type ManagedEntityFixtureName,
} from "@sandboxd/core";
import { spawn } from "node:child_process";

const defaultFixtureName = parseFixtureName(process.env.SANDBOXD_ENTITY_FIXTURE) ?? "mixed";
const listUnitsArgs = ["list-units", "--all", "--plain", "--no-legend", "--no-pager"];

export async function listEntities(
  fixtureName: ManagedEntityFixtureName = defaultFixtureName,
): Promise<ManagedEntity[]> {
  if (process.env.SANDBOXD_ENTITY_FIXTURE || process.platform !== "linux") {
    return getManagedEntityFixture(fixtureName);
  }

  try {
    const stdout = await runSystemctl(listUnitsArgs);
    const records = parseSystemctlListUnitsOutput(stdout);

    if (records.length === 0) {
      return getManagedEntityFixture(fixtureName);
    }

    return records.map(mapSystemdUnitRecord);
  } catch {
    return getManagedEntityFixture(fixtureName);
  }
}

function parseFixtureName(value: string | undefined): ManagedEntityFixtureName | undefined {
  if (!value) {
    return undefined;
  }

  if (managedEntityFixtureNames.includes(value as ManagedEntityFixtureName)) {
    return value as ManagedEntityFixtureName;
  }

  throw new TypeError(`Unknown entity fixture: ${value}`);
}

export function parseSystemctlListUnitsOutput(stdout: string): SystemdUnitRecord[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match =
        /^(?<unitName>\S+)\s+(?<loadState>\S+)\s+(?<activeState>\S+)\s+(?<subState>\S+)\s+(?<description>.*)$/.exec(
          line,
        );

      if (!match?.groups) {
        return null;
      }

      return {
        unitName: match.groups.unitName,
        loadState: match.groups.loadState,
        activeState: match.groups.activeState,
        subState: match.groups.subState,
        description: match.groups.description,
      };
    })
    .filter((record): record is SystemdUnitRecord => record !== null);
}

function runSystemctl(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("systemctl", args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr || `systemctl exited with code ${code ?? "unknown"}`));
    });
  });
}
