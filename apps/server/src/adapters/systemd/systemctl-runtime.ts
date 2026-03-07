import { spawn } from "node:child_process";
import type { Sandboxing, SystemdUnitDetailRecord, SystemdUnitRecord } from "@sandboxd/core";
import type { SystemdRuntimePort } from "../../ports/systemd-runtime-port";

const listUnitsArgs = ["list-units", "--all", "--plain", "--no-legend", "--no-pager"];

export function createSystemctlRuntime(): SystemdRuntimePort {
  return {
    async listUnits() {
      ensureSystemctlAvailable();
      const stdout = await runSystemctl(listUnitsArgs);
      return parseSystemctlListUnitsOutput(stdout);
    },
    async getUnit(unitName) {
      ensureSystemctlAvailable();
      const stdout = await runSystemctl([
        "show",
        unitName,
        "--property=Id,Description,LoadState,ActiveState,SubState,Slice,FragmentPath,UnitFileState,CPUWeight,MemoryMax,TasksMax,NoNewPrivileges,PrivateTmp,ProtectSystem,ProtectHome",
      ]);

      return parseSystemctlShowOutput(stdout);
    },
    async startUnit(unitName) {
      ensureSystemctlAvailable();
      await runSystemctl(["start", unitName]);
    },
    async stopUnit(unitName) {
      ensureSystemctlAvailable();
      await runSystemctl(["stop", unitName]);
    },
    async restartUnit(unitName) {
      ensureSystemctlAvailable();
      await runSystemctl(["restart", unitName]);
    },
  };
}

function ensureSystemctlAvailable() {
  if (shouldUseFixture()) {
    throw new Error("systemctl runtime disabled while fixture mode is enabled");
  }

  if (process.platform !== "linux") {
    throw new Error("systemctl runtime is only available on Linux");
  }
}

export function shouldUseFixture(environment: NodeJS.ProcessEnv = process.env) {
  if (environment.SANDBOXD_USE_FIXTURE) {
    return environment.SANDBOXD_USE_FIXTURE !== "0";
  }

  return Boolean(environment.SANDBOXD_ENTITY_FIXTURE) || process.platform !== "linux";
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

export function parseSystemctlShowOutput(stdout: string): SystemdUnitDetailRecord | null {
  const values = new Map<string, string>();

  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    values.set(trimmed.slice(0, separatorIndex), trimmed.slice(separatorIndex + 1));
  }

  const unitName = values.get("Id");
  if (!unitName) {
    return null;
  }

  return {
    unitName,
    description: values.get("Description") ?? "",
    loadState: values.get("LoadState") ?? "unknown",
    activeState: values.get("ActiveState") ?? "unknown",
    subState: values.get("SubState") ?? "unknown",
    slice: values.get("Slice") || undefined,
    fragmentPath: values.get("FragmentPath") || undefined,
    unitFileState: values.get("UnitFileState") || undefined,
    resourceControls: {
      cpuWeight: values.get("CPUWeight") || undefined,
      memoryMax: values.get("MemoryMax") || undefined,
      tasksMax: values.get("TasksMax") || undefined,
    },
    sandboxing: parseSandboxing(values),
  };
}

function parseSandboxing(values: Map<string, string>): Sandboxing {
  return {
    noNewPrivileges: parseBooleanProperty(values.get("NoNewPrivileges")),
    privateTmp: parseBooleanProperty(values.get("PrivateTmp")),
    protectSystem: values.get("ProtectSystem") || undefined,
    protectHome: parseBooleanProperty(values.get("ProtectHome")),
  };
}

function parseBooleanProperty(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  if (value === "yes" || value === "true") {
    return true;
  }

  if (value === "no" || value === "false") {
    return false;
  }

  return undefined;
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
