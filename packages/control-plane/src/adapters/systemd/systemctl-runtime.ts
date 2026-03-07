import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  AdvancedBooleanListMode,
  AdvancedListMode,
  AdvancedProperties,
  CountLimitValue,
  CreateSandboxServiceInput,
  CpuWeightValue,
  Sandboxing,
  SizeLimitValue,
  SystemdUnitDetailRecord,
  SystemdUnitRecord,
} from "@sandboxd/core";
import type { SystemdRuntimePort } from "../../ports/systemd-runtime-port";

const listUnitsArgs = ["list-units", "--all", "--plain", "--no-legend", "--no-pager"];

export function createSystemctlRuntime(): SystemdRuntimePort {
  return {
    async createSandboxService(unitName, input) {
      ensureSystemctlAvailable();
      const unitPath = getUnitFilePath(unitName);
      await mkdir(dirname(unitPath), { recursive: true });
      await writeFile(unitPath, renderSandboxServiceUnitFile(unitName, input), "utf8");
      await runSystemctl(["daemon-reload"]);
    },
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
    async reloadSystemd() {
      ensureSystemctlAvailable();
      await runSystemctl(["daemon-reload"]);
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

export function getUnitFilePath(unitName: string, environment: NodeJS.ProcessEnv = process.env) {
  const unitDir = environment.SANDBOXD_SYSTEMD_UNIT_DIR ?? "/etc/systemd/system";
  return join(unitDir, unitName);
}

export function renderSandboxServiceUnitFile(
  unitName: string,
  input: CreateSandboxServiceInput,
): string {
  const lines = [
    "[Unit]",
    `Description=${escapeUnitValue(input.description ?? `Sandboxd managed ${unitName}`)}`,
    "",
    "[Service]",
    "Type=simple",
    `ExecStart=${input.execStart}`,
    input.workingDirectory ? `WorkingDirectory=${escapeUnitValue(input.workingDirectory)}` : null,
    input.slice ? `Slice=${escapeUnitValue(input.slice)}` : "Slice=sandboxd.slice",
    renderEnvironmentLines(input.environment),
    renderResourceControlLines(input.resourceControls),
    renderSandboxingLines(resolveSandboxingDefaults(input)),
    renderAdvancedPropertyLines(input.advancedProperties),
    "",
    "[Install]",
    "WantedBy=multi-user.target",
    "",
  ];

  return lines
    .flat()
    .filter((line): line is string => line !== null && line !== "")
    .join("\n");
}

function renderEnvironmentLines(environment: Record<string, string> | undefined) {
  if (!environment) {
    return [];
  }

  return Object.entries(environment)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `Environment=${key}=${escapeEnvironmentValue(value)}`);
}

function renderResourceControlLines(
  resourceControls: CreateSandboxServiceInput["resourceControls"],
) {
  if (!resourceControls) {
    return [];
  }

  return [
    resourceControls.cpuWeight ? `CPUWeight=${resourceControls.cpuWeight}` : null,
    resourceControls.memoryMax ? `MemoryMax=${resourceControls.memoryMax}` : null,
    resourceControls.tasksMax ? `TasksMax=${resourceControls.tasksMax}` : null,
  ].filter((line): line is string => Boolean(line));
}

function renderSandboxingLines(sandboxing: Sandboxing) {
  return [
    sandboxing.noNewPrivileges !== undefined
      ? `NoNewPrivileges=${sandboxing.noNewPrivileges ? "yes" : "no"}`
      : null,
    sandboxing.privateTmp !== undefined
      ? `PrivateTmp=${sandboxing.privateTmp ? "yes" : "no"}`
      : null,
    sandboxing.protectSystem ? `ProtectSystem=${sandboxing.protectSystem}` : null,
    sandboxing.protectHome !== undefined
      ? `ProtectHome=${sandboxing.protectHome ? "yes" : "no"}`
      : null,
  ].filter((line): line is string => Boolean(line));
}

function renderAdvancedPropertyLines(advancedProperties: AdvancedProperties | undefined) {
  if (!advancedProperties) {
    return [];
  }

  return [
    renderParsedOrRawDirective(
      "ProtectSystem",
      advancedProperties.ProtectSystem,
      renderBooleanEnumValue,
    ),
    renderParsedOrRawDirective(
      "ProtectHome",
      advancedProperties.ProtectHome,
      renderBooleanEnumValue,
    ),
    renderParsedOrRawDirective("PrivateTmp", advancedProperties.PrivateTmp, renderBooleanEnumValue),
    renderParsedOrRawDirective(
      "NoNewPrivileges",
      advancedProperties.NoNewPrivileges,
      renderBooleanValue,
    ),
    renderParsedOrRawDirective(
      "PrivateDevices",
      advancedProperties.PrivateDevices,
      renderBooleanValue,
    ),
    renderParsedOrRawDirective("PrivateUsers", advancedProperties.PrivateUsers, renderBooleanValue),
    renderParsedOrRawDirective(
      "PrivateNetwork",
      advancedProperties.PrivateNetwork,
      renderBooleanValue,
    ),
    renderRepeatedParsedOrRawDirective(
      "ReadOnlyPaths",
      advancedProperties.ReadOnlyPaths,
      renderStringListValue,
    ),
    renderRepeatedParsedOrRawDirective(
      "ReadWritePaths",
      advancedProperties.ReadWritePaths,
      renderStringListValue,
    ),
    renderRepeatedParsedOrRawDirective(
      "InaccessiblePaths",
      advancedProperties.InaccessiblePaths,
      renderStringListValue,
    ),
    renderRepeatedParsedOrRawDirective(
      "CapabilityBoundingSet",
      advancedProperties.CapabilityBoundingSet,
      renderAdvancedListMode,
    ),
    renderRepeatedParsedOrRawDirective(
      "RestrictNamespaces",
      advancedProperties.RestrictNamespaces,
      renderAdvancedBooleanListMode,
    ),
    renderRepeatedParsedOrRawDirective(
      "SystemCallFilter",
      advancedProperties.SystemCallFilter,
      renderAdvancedListMode,
    ),
    renderRepeatedParsedOrRawDirective(
      "RestrictAddressFamilies",
      advancedProperties.RestrictAddressFamilies,
      renderAdvancedListMode,
    ),
    renderParsedOrRawDirective("CPUWeight", advancedProperties.CPUWeight, renderCpuWeightValue),
    renderParsedOrRawDirective("MemoryMax", advancedProperties.MemoryMax, renderSizeLimitValue),
    renderParsedOrRawDirective("TasksMax", advancedProperties.TasksMax, renderCountLimitValue),
    renderParsedOrRawDirective(
      "WorkingDirectory",
      advancedProperties.WorkingDirectory,
      renderIdentityValue,
    ),
    renderEnvironmentProperty(advancedProperties.Environment),
  ].filter((line): line is string => Boolean(line));
}

function renderParsedOrRawDirective<T extends { parsed?: unknown; raw?: string }>(
  key: string,
  value: T | undefined,
  renderParsed: (parsed: Exclude<T["parsed"], undefined>) => string,
) {
  if (!value) {
    return null;
  }

  if (value.parsed !== undefined) {
    return `${key}=${renderParsed(value.parsed as Exclude<T["parsed"], undefined>)}`;
  }

  if (value.raw !== undefined) {
    return `${key}=${value.raw}`;
  }

  return null;
}

function renderRepeatedParsedOrRawDirective<T extends { parsed?: unknown; raw?: string }>(
  key: string,
  value: T[] | undefined,
  renderParsed: (parsed: Exclude<T["parsed"], undefined>) => string,
) {
  if (!value || value.length === 0) {
    return null;
  }

  return value
    .map((entry) => renderParsedOrRawDirective(key, entry, renderParsed))
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function renderBooleanValue(value: boolean) {
  return value ? "yes" : "no";
}

function renderBooleanEnumValue(value: boolean | string) {
  if (typeof value === "boolean") {
    return renderBooleanValue(value);
  }

  return value;
}

function renderStringListValue(values: string[]) {
  return values.join(" ");
}

function renderAdvancedListMode(value: AdvancedListMode) {
  if (value.mode === "reset") {
    return "";
  }

  return value.mode === "deny" ? `~${value.values.join(" ")}` : value.values.join(" ");
}

function renderAdvancedBooleanListMode(value: AdvancedBooleanListMode) {
  if (value.mode === "boolean") {
    return renderBooleanValue(value.value);
  }

  return renderAdvancedListMode(value);
}

function renderCpuWeightValue(value: CpuWeightValue) {
  if (value.kind === "idle") {
    return "idle";
  }

  return String(value.value);
}

function renderSizeLimitValue(value: SizeLimitValue) {
  switch (value.kind) {
    case "infinity":
      return "infinity";
    case "percentage":
      return `${value.value}%`;
    case "size":
      return value.value;
  }
}

function renderCountLimitValue(value: CountLimitValue) {
  switch (value.kind) {
    case "infinity":
      return "infinity";
    case "percentage":
      return `${value.value}%`;
    case "count":
      return String(value.value);
  }
}

function renderIdentityValue(value: string) {
  return escapeUnitValue(value);
}

function renderEnvironmentProperty(value: AdvancedProperties["Environment"] | undefined) {
  if (!value || value.length === 0) {
    return null;
  }

  return value
    .flatMap((entry) => {
      if (entry.parsed) {
        return Object.entries(entry.parsed)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => `Environment=${key}=${escapeEnvironmentValue(item)}`);
      }

      if (entry.raw) {
        return [`Environment=${entry.raw}`];
      }

      return [];
    })
    .join("\n");
}

function resolveSandboxingDefaults(input: CreateSandboxServiceInput): Sandboxing {
  const profileDefaults = getSandboxProfileDefaults(input.sandboxProfile);

  return {
    ...profileDefaults,
    ...input.sandboxing,
  };
}

function getSandboxProfileDefaults(profile: string | undefined): Sandboxing {
  if (profile === "strict") {
    return {
      noNewPrivileges: true,
      privateTmp: true,
      protectSystem: "strict",
      protectHome: true,
    };
  }

  if (profile === "baseline") {
    return {
      noNewPrivileges: true,
      privateTmp: true,
      protectSystem: "full",
      protectHome: false,
    };
  }

  return {};
}

function escapeEnvironmentValue(value: string) {
  return JSON.stringify(value);
}

function escapeUnitValue(value: string) {
  return value.replaceAll("\n", " ").trim();
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
