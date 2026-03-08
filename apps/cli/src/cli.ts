import type {
  CreateSandboxServiceInput,
  DangerousAdoptManagedEntityInput,
  ManagedEntityDetail,
  ManagedEntitySummary,
} from "@sandboxd/core";
import { createControlPlane, type ControlPlane } from "@sandboxd/control-plane";

export interface CliIo {
  createControlPlane?: (environment: NodeJS.ProcessEnv) => CliControlPlane;
  env?: NodeJS.ProcessEnv;
  stderr?: { write(chunk: string): void };
  stdout?: { write(chunk: string): void };
}

interface ParsedCommonFlags {
  args: string[];
  json: boolean;
}

type CliControlPlane = Pick<
  ControlPlane,
  | "createSandboxService"
  | "deleteSandboxService"
  | "dangerouslyAdoptManagedEntity"
  | "inspectManagedEntity"
  | "listManagedEntities"
  | "restartManagedEntity"
  | "startManagedEntity"
  | "stopManagedEntity"
  | "updateSandboxService"
>;

type CreateDraft = Record<string, string | boolean>;

export async function runCli(argv: string[], io: CliIo = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;

  try {
    const parsed = parseCommonFlags(argv);

    if (parsed.args.length === 0 || parsed.args[0] === "--help" || parsed.args[0] === "help") {
      stdout.write(`${usageText}\n`);
      return 0;
    }

    const controlPlane = (io.createControlPlane ?? createControlPlane)(io.env ?? process.env);

    const [command, ...rest] = parsed.args;

    if (command === "list") {
      const entities = await controlPlane.listManagedEntities();
      writeOutput(stdout, parsed.json, entities, formatEntityList(entities));
      return 0;
    }

    if (command === "inspect") {
      const unitName = requirePositional(rest[0], "inspect requires <unitName>");
      const detail = await controlPlane.inspectManagedEntity(unitName);
      writeOutput(stdout, parsed.json, detail, formatEntityDetail(detail));
      return 0;
    }

    if (command === "start") {
      const unitName = requirePositional(rest[0], "start requires <unitName>");
      const detail = await controlPlane.startManagedEntity(unitName);
      writeOutput(stdout, parsed.json, detail, formatActionResult(command, detail));
      return 0;
    }

    if (command === "stop") {
      const unitName = requirePositional(rest[0], "stop requires <unitName>");
      const detail = await controlPlane.stopManagedEntity(unitName);
      writeOutput(stdout, parsed.json, detail, formatActionResult(command, detail));
      return 0;
    }

    if (command === "restart") {
      const unitName = requirePositional(rest[0], "restart requires <unitName>");
      const detail = await controlPlane.restartManagedEntity(unitName);
      writeOutput(stdout, parsed.json, detail, formatActionResult(command, detail));
      return 0;
    }

    if (command === "create") {
      return await handleCreateCommand(rest, parsed.json, stdout, controlPlane);
    }

    if (command === "update") {
      return await handleUpdateCommand(rest, parsed.json, stdout, controlPlane);
    }

    if (command === "delete") {
      return await handleDeleteCommand(rest, parsed.json, stdout, controlPlane);
    }

    if (command === "dangerous-adopt") {
      return await handleDangerousAdoptCommand(rest, parsed.json, stdout, controlPlane);
    }

    stderr.write(`Unknown command: ${command}\n`);
    stderr.write(`${usageText}\n`);
    return 2;
  } catch (error: unknown) {
    const exitCode = error instanceof CliArgumentError ? 2 : 1;
    const stderr = io.stderr ?? process.stderr;
    stderr.write(`${error instanceof Error ? error.message : "Unknown error"}\n`);
    return exitCode;
  }
}

async function handleCreateCommand(
  args: string[],
  json: boolean,
  stdout: { write(chunk: string): void },
  controlPlane: CliControlPlane,
) {
  if (args[0] !== "sandboxed-service") {
    throw new CliArgumentError("create requires the sandboxed-service subcommand");
  }

  const name = requirePositional(args[1], "create sandboxed-service requires <name>");
  const draft = parseCreateFlags(args.slice(2));
  const execStart = asOptionalString(draft.execStart);
  if (!execStart) {
    throw new CliArgumentError("create sandboxed-service requires --exec-start <cmd>");
  }

  const input: CreateSandboxServiceInput = {
    name,
    execStart,
    description: asOptionalString(draft.description),
    workingDirectory: asOptionalString(draft.workingDirectory),
    slice: asOptionalString(draft.slice),
    sandboxProfile: asOptionalProfile(draft.profile),
    resourceControls: {
      cpuWeight: asOptionalString(draft.cpuWeight),
      memoryMax: asOptionalString(draft.memoryMax),
      tasksMax: asOptionalString(draft.tasksMax),
    },
    sandboxing: {
      noNewPrivileges: asOptionalBoolean(draft.noNewPrivileges),
      privateTmp: asOptionalBoolean(draft.privateTmp),
      protectSystem: asOptionalString(draft.protectSystem),
      protectHome: asOptionalBoolean(draft.protectHome),
    },
  };

  const created = await controlPlane.createSandboxService(input);
  writeOutput(stdout, json, created, formatActionResult("create", created));
  return 0;
}

async function handleDangerousAdoptCommand(
  args: string[],
  json: boolean,
  stdout: { write(chunk: string): void },
  controlPlane: CliControlPlane,
) {
  const unitName = requirePositional(args[0], "dangerous-adopt requires <unitName>");
  const options = parseDangerousAdoptFlags(args.slice(1));
  const input: DangerousAdoptManagedEntityInput = {
    sandboxProfile: asOptionalProfile(options.profile),
  };

  const adopted = await controlPlane.dangerouslyAdoptManagedEntity(unitName, input);
  writeOutput(stdout, json, adopted, formatActionResult("dangerous-adopt", adopted));
  return 0;
}

async function handleUpdateCommand(
  args: string[],
  json: boolean,
  stdout: { write(chunk: string): void },
  controlPlane: CliControlPlane,
) {
  if (args[0] !== "sandboxed-service") {
    throw new CliArgumentError("update requires the sandboxed-service subcommand");
  }

  const unitName = requirePositional(args[1], "update sandboxed-service requires <unitName>");
  const draft = parseCreateFlags(args.slice(2));
  const execStart = asOptionalString(draft.execStart);
  if (!execStart) {
    throw new CliArgumentError("update sandboxed-service requires --exec-start <cmd>");
  }

  const input: CreateSandboxServiceInput = {
    name: unitName.replace(/\.service$/, ""),
    execStart,
    description: asOptionalString(draft.description),
    workingDirectory: asOptionalString(draft.workingDirectory),
    slice: asOptionalString(draft.slice),
    sandboxProfile: asOptionalProfile(draft.profile),
    resourceControls: {
      cpuWeight: asOptionalString(draft.cpuWeight),
      memoryMax: asOptionalString(draft.memoryMax),
      tasksMax: asOptionalString(draft.tasksMax),
    },
    sandboxing: {
      noNewPrivileges: asOptionalBoolean(draft.noNewPrivileges),
      privateTmp: asOptionalBoolean(draft.privateTmp),
      protectSystem: asOptionalString(draft.protectSystem),
      protectHome: asOptionalBoolean(draft.protectHome),
    },
  };

  const updated = await controlPlane.updateSandboxService(unitName, input);
  writeOutput(stdout, json, updated, formatActionResult("update", updated));
  return 0;
}

async function handleDeleteCommand(
  args: string[],
  json: boolean,
  stdout: { write(chunk: string): void },
  controlPlane: CliControlPlane,
) {
  if (args[0] !== "sandboxed-service") {
    throw new CliArgumentError("delete requires the sandboxed-service subcommand");
  }

  const unitName = requirePositional(args[1], "delete sandboxed-service requires <unitName>");
  await controlPlane.deleteSandboxService(unitName);

  if (json) {
    stdout.write(`${JSON.stringify({ deleted: true, unitName }, null, 2)}\n`);
  } else {
    stdout.write(`delete: ${unitName}\n`);
  }

  return 0;
}

function parseCommonFlags(argv: string[]): ParsedCommonFlags {
  const remainingArgs: string[] = [];
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument) {
      continue;
    }

    if (argument === "--json") {
      json = true;
      continue;
    }

    remainingArgs.push(argument);
  }

  return {
    args: remainingArgs,
    json,
  };
}

function parseCreateFlags(args: string[]): CreateDraft {
  const result: CreateDraft = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument?.startsWith("--")) {
      throw new CliArgumentError(`Unexpected argument: ${argument}`);
    }

    const key = toCreateDraftKey(argument.slice(2));
    if (isBooleanCreateFlag(key)) {
      result[key] = true;
      continue;
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new CliArgumentError(`${argument} requires a value`);
    }

    result[key] = value;
    index += 1;
  }

  return result;
}

function parseDangerousAdoptFlags(args: string[]) {
  const result: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument?.startsWith("--")) {
      throw new CliArgumentError(`Unexpected argument: ${argument}`);
    }

    if (argument !== "--profile") {
      throw new CliArgumentError(`Unknown dangerous-adopt flag: ${argument}`);
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new CliArgumentError(`${argument} requires a value`);
    }

    result.profile = value;
    index += 1;
  }

  return result;
}

function toCreateDraftKey(flag: string) {
  const segments = flag.split("-");
  const [firstSegment, ...restSegments] = segments;
  if (!firstSegment) {
    throw new CliArgumentError(`Invalid flag: --${flag}`);
  }

  return [
    firstSegment,
    ...restSegments.map((segment) => segment[0]?.toUpperCase() + segment.slice(1)),
  ].join("");
}

function isBooleanCreateFlag(key: string) {
  return key === "noNewPrivileges" || key === "privateTmp" || key === "protectHome";
}

function requirePositional(value: string | undefined, message: string) {
  if (!value) {
    throw new CliArgumentError(message);
  }

  return value;
}

function asOptionalString(value: string | boolean | undefined) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asOptionalBoolean(value: string | boolean | undefined) {
  return typeof value === "boolean" ? value : undefined;
}

function asOptionalProfile(value: string | boolean | undefined) {
  return value === "baseline" || value === "strict" ? value : undefined;
}

function writeOutput(
  stdout: { write(chunk: string): void },
  json: boolean,
  payload: ManagedEntityDetail | ManagedEntitySummary[],
  text: string,
) {
  stdout.write(json ? `${JSON.stringify(payload, null, 2)}\n` : `${text}\n`);
}

function formatEntityList(entities: ManagedEntitySummary[]) {
  const rows = entities.map((entity) => ({
    UNIT: entity.unitName,
    STATE: entity.state,
    ORIGIN: entity.origin,
    KIND: entity.kind,
    SLICE: entity.slice ?? "n/a",
  }));

  const headers = ["UNIT", "STATE", "ORIGIN", "KIND", "SLICE"] as const;
  const widths = Object.fromEntries(
    headers.map((header) => [
      header,
      Math.max(header.length, ...rows.map((row) => row[header].length)),
    ]),
  ) as Record<(typeof headers)[number], number>;

  return [
    headers.map((header) => header.padEnd(widths[header])).join("  "),
    ...rows.map((row) => headers.map((header) => row[header].padEnd(widths[header])).join("  ")),
  ].join("\n");
}

function formatEntityDetail(detail: ManagedEntityDetail) {
  return [
    `${detail.unitName}`,
    `state: ${detail.status.activeState} / ${detail.status.subState}`,
    `loadState: ${detail.status.loadState}`,
    `unitType: ${detail.unitType}`,
    `origin: ${detail.origin}`,
    `kind: ${detail.kind}`,
    `slice: ${detail.slice ?? "n/a"}`,
    `sandboxProfile: ${detail.sandboxProfile ?? "n/a"}`,
    "",
    "resourceControls:",
    `  cpuWeight: ${detail.resourceControls.cpuWeight ?? "n/a"}`,
    `  memoryMax: ${detail.resourceControls.memoryMax ?? "n/a"}`,
    `  tasksMax: ${detail.resourceControls.tasksMax ?? "n/a"}`,
    "",
    "sandboxing:",
    `  noNewPrivileges: ${formatBoolean(detail.sandboxing.noNewPrivileges)}`,
    `  privateTmp: ${formatBoolean(detail.sandboxing.privateTmp)}`,
    `  protectSystem: ${detail.sandboxing.protectSystem ?? "n/a"}`,
    `  protectHome: ${formatBoolean(detail.sandboxing.protectHome)}`,
    "",
    "capabilities:",
    `  canInspect: ${detail.capabilities.canInspect}`,
    `  canStart: ${detail.capabilities.canStart}`,
    `  canStop: ${detail.capabilities.canStop}`,
    `  canRestart: ${detail.capabilities.canRestart}`,
  ].join("\n");
}

function formatActionResult(action: string, detail: ManagedEntityDetail) {
  return `${action}: ${detail.unitName} -> ${detail.status.activeState}/${detail.status.subState}`;
}

function formatBoolean(value: boolean | undefined) {
  if (value === undefined) {
    return "n/a";
  }

  return value ? "true" : "false";
}

class CliArgumentError extends Error {}

const usageText = `Usage:
  sandboxctl list [--json]
  sandboxctl inspect <unitName> [--json]
  sandboxctl start <unitName> [--json]
  sandboxctl stop <unitName> [--json]
  sandboxctl restart <unitName> [--json]
  sandboxctl dangerous-adopt <unitName> [--profile <profile>] [--json]
  sandboxctl create sandboxed-service <name> --exec-start <cmd> [flags...] [--json]
  sandboxctl update sandboxed-service <unitName> --exec-start <cmd> [flags...] [--json]
  sandboxctl delete sandboxed-service <unitName> [--json]`;
