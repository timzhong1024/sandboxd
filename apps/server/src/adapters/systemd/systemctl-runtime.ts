import { spawn } from "node:child_process";
import type { SystemdUnitRecord } from "@sandboxd/core";
import type { SystemdRuntimePort } from "../../ports/systemd-runtime-port";

const listUnitsArgs = ["list-units", "--all", "--plain", "--no-legend", "--no-pager"];

export function createSystemctlRuntime(): SystemdRuntimePort {
  return {
    async listUnits() {
      if (process.platform !== "linux") {
        throw new Error("systemctl runtime is only available on Linux");
      }

      const stdout = await runSystemctl(listUnitsArgs);
      return parseSystemctlListUnitsOutput(stdout);
    },
  };
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
