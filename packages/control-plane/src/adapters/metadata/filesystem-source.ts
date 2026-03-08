import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  type AdvancedBooleanListMode,
  type AdvancedListMode,
  type AdvancedProperties,
  type CreateSandboxServiceInput,
  type DangerousAdoptManagedEntityInput,
  type SandboxProfile,
  type SupportedAdvancedPropertyKey,
  type UnknownSystemdDirective,
} from "@sandboxd/core";
import {
  advancedPropertiesSchema,
  parseAdvancedPropertyDirective,
  supportedAdvancedPropertyKeys,
  unknownSystemdDirectiveSchema,
} from "@sandboxd/core";
import { z } from "zod";
import type {
  ManagedEntityMetadataRecord,
  ManagedEntityMetadataSourcePort,
} from "../../ports/managed-entity-metadata-source-port";

const managedSectionName = "X-Sandboxd";
const adoptDropInFileName = "90-sandboxd-owned.conf";
const serviceSectionName = "Service";
const ignoredKnownDirectiveKeys = new Set([
  "Description",
  "ExecStart",
  "ExecStartPre",
  "ExecStartPost",
  "Type",
  "Slice",
  "WantedBy",
]);

const sandboxdMetadataSchema = z.object({
  owned: z.boolean().optional(),
  sandboxProfile: z.string().optional(),
  advancedProperties: advancedPropertiesSchema.optional(),
  unknownSystemdDirectives: z.array(unknownSystemdDirectiveSchema).optional(),
});

interface CreateFilesystemMetadataSourceOptions {
  rootDir?: string;
}

export function createFilesystemMetadataSource(
  options: CreateFilesystemMetadataSourceOptions = {},
): Pick<
  ManagedEntityMetadataSourcePort,
  | "dangerouslyAdoptManagedEntity"
  | "deleteManagedEntityMetadata"
  | "getManagedEntityMetadata"
  | "listManagedEntityMetadata"
  | "saveManagedEntityMetadata"
  | "updateManagedEntityMetadata"
> {
  const rootDir = options.rootDir ?? getDefaultMetadataRootDir();
  const getManagedMetadataForUnit = async (unitName: string) => {
    const metadata = await readSandboxdMetadata(rootDir, unitName);
    if (!metadata?.owned) {
      return null;
    }

    return createMetadataRecord({
      advancedProperties: metadata.advancedProperties,
      unknownSystemdDirectives: metadata.unknownSystemdDirectives,
      unitName,
      sandboxProfile: normalizeSandboxProfile(metadata.sandboxProfile),
    });
  };
  const saveManagedEntityMetadata = async (unitName: string, input: CreateSandboxServiceInput) => {
    const record = createMetadataRecord({
      unitName,
      sandboxProfile: input.sandboxProfile,
    });

    await writeSandboxdDropIn(rootDir, unitName, {
      sandboxProfile: input.sandboxProfile,
    });

    return record;
  };

  return {
    async dangerouslyAdoptManagedEntity(unitName, input) {
      const record = createMetadataRecord({
        unitName,
        sandboxProfile: input.sandboxProfile,
      });

      await writeSandboxdDropIn(rootDir, unitName, input);
      return record;
    },
    async deleteManagedEntityMetadata(unitName) {
      await rm(getSandboxdDropInPath(rootDir, unitName), { force: true });
    },
    async getManagedEntityMetadata(unitName) {
      return getManagedMetadataForUnit(unitName);
    },
    async listManagedEntityMetadata() {
      const records = await Promise.all(
        [...(await listCandidateUnitNames(rootDir))].map((unitName) =>
          getManagedMetadataForUnit(unitName),
        ),
      );
      const managedRecords = records.filter((record): record is ManagedEntityMetadataRecord =>
        Boolean(record),
      );
      managedRecords.sort((left, right) => left.unitName.localeCompare(right.unitName));
      return managedRecords;
    },
    saveManagedEntityMetadata,
    async updateManagedEntityMetadata(unitName, input: CreateSandboxServiceInput) {
      return saveManagedEntityMetadata(unitName, input);
    },
  };
}

export function getDefaultMetadataRootDir(environment: NodeJS.ProcessEnv = process.env) {
  return environment.SANDBOXD_SYSTEMD_UNIT_DIR ?? "/etc/systemd/system";
}

async function listCandidateUnitNames(rootDir: string) {
  try {
    const entries = await readdir(rootDir, { withFileTypes: true });
    const unitNames = new Set<string>();

    for (const entry of entries) {
      if (entry.isFile() && entry.name.includes(".")) {
        unitNames.add(entry.name);
      }

      if (entry.isDirectory() && entry.name.endsWith(".d")) {
        unitNames.add(entry.name.slice(0, -2));
      }
    }

    return unitNames;
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return new Set<string>();
    }

    throw error;
  }
}

function createMetadataRecord(record: {
  advancedProperties?: AdvancedProperties;
  sandboxProfile: SandboxProfile | undefined;
  unknownSystemdDirectives?: UnknownSystemdDirective[];
  unitName: string;
}): ManagedEntityMetadataRecord {
  return {
    unitName: record.unitName,
    resourceControls: {},
    sandboxing: {},
    ...(record.advancedProperties ? { advancedProperties: record.advancedProperties } : {}),
    ...(record.unknownSystemdDirectives
      ? { unknownSystemdDirectives: record.unknownSystemdDirectives }
      : {}),
    ...(record.sandboxProfile ? { sandboxProfile: record.sandboxProfile } : {}),
  };
}

function normalizeSandboxProfile(value: string | undefined): SandboxProfile | undefined {
  if (value === "baseline" || value === "strict") {
    return value;
  }

  return undefined;
}

async function readSandboxdMetadata(rootDir: string, unitName: string) {
  const sources = [
    { path: getManagedUnitFilePath(rootDir, unitName), source: "unit-file" as const },
    ...((await listDropInFiles(rootDir, unitName)).map((path) => ({
      path,
      source: "drop-in" as const,
    })) ?? []),
  ];
  const parsedFiles = (
    await Promise.all(
      sources.map(async ({ path, source }) => {
        const text = await readTextIfPresent(path);
        if (!text) {
          return null;
        }

        return parseSystemdConfigText(text, source);
      }),
    )
  ).filter((record): record is ParsedSystemdConfigFile => Boolean(record));

  const merged = parsedFiles.reduce<Record<string, string>>((result, file) => {
    return {
      ...result,
      ...file.sandboxdDirectives,
    };
  }, {});
  const advancedProperties = parsedFiles.reduce<AdvancedProperties>(
    (result, file) => mergeAdvancedProperties(result, file.advancedProperties),
    {},
  );
  const unknownSystemdDirectives = parsedFiles.flatMap((file) => file.unknownSystemdDirectives);

  return sandboxdMetadataSchema.parse({
    owned: parseBooleanValue(merged.Owned ?? merged["X-Sandboxd-Owned"]),
    advancedProperties,
    unknownSystemdDirectives,
    sandboxProfile: normalizeSandboxProfile(merged.Profile ?? merged["X-Sandboxd-Profile"]),
  });
}

async function writeSandboxdDropIn(
  rootDir: string,
  unitName: string,
  input: DangerousAdoptManagedEntityInput,
) {
  const dropInDir = getManagedDropInDirPath(rootDir, unitName);
  await mkdir(dropInDir, { recursive: true });
  await writeFile(getSandboxdDropInPath(rootDir, unitName), renderSandboxdDropIn(input), "utf8");
}

async function listDropInFiles(rootDir: string, unitName: string) {
  const dropInDir = getManagedDropInDirPath(rootDir, unitName);

  try {
    const entries = await readdir(dropInDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".conf"))
      .map((entry) => join(dropInDir, entry.name))
      .sort((left, right) => left.localeCompare(right));
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function readTextIfPresent(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

function renderSandboxdDropIn(input: DangerousAdoptManagedEntityInput) {
  return [
    `[${managedSectionName}]`,
    "Owned=yes",
    input.sandboxProfile ? `Profile=${input.sandboxProfile}` : null,
    "",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

interface ParsedSystemdConfigFile {
  advancedProperties: AdvancedProperties;
  sandboxdDirectives: Record<string, string>;
  unknownSystemdDirectives: UnknownSystemdDirective[];
}

function parseSystemdConfigText(
  text: string,
  source: UnknownSystemdDirective["source"],
): ParsedSystemdConfigFile {
  const sandboxdDirectives: Record<string, string> = {};
  const advancedProperties: AdvancedProperties = {};
  const unknownSystemdDirectives: UnknownSystemdDirective[] = [];
  let currentSection = "";

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) {
      continue;
    }

    if (line.startsWith("[") && line.endsWith("]")) {
      currentSection = line.slice(1, -1);
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (currentSection === managedSectionName || key.startsWith("X-Sandboxd-")) {
      sandboxdDirectives[key] = value;
      continue;
    }

    if (currentSection !== serviceSectionName) {
      continue;
    }

    const nextAdvancedProperty = parseSupportedAdvancedProperty(key, value);
    if (nextAdvancedProperty) {
      Object.assign(
        advancedProperties,
        mergeAdvancedProperties(advancedProperties, nextAdvancedProperty),
      );
      continue;
    }

    if (!ignoredKnownDirectiveKeys.has(key)) {
      unknownSystemdDirectives.push({
        section: currentSection,
        key,
        value,
        source,
      });
    }
  }

  return {
    sandboxdDirectives,
    advancedProperties,
    unknownSystemdDirectives,
  };
}

function parseSupportedAdvancedProperty(key: string, value: string): AdvancedProperties | null {
  if (!supportedAdvancedPropertyKeys.includes(key as SupportedAdvancedPropertyKey)) {
    return null;
  }

  const supportedKey = key as SupportedAdvancedPropertyKey;
  return {
    [supportedKey]: parseAdvancedPropertyDirective(supportedKey, value),
  } as AdvancedProperties;
}

function mergeAdvancedProperties(
  left: AdvancedProperties,
  right: AdvancedProperties,
): AdvancedProperties {
  const merged: AdvancedProperties = {};
  const next = merged as Record<
    SupportedAdvancedPropertyKey,
    AdvancedProperties[SupportedAdvancedPropertyKey] | undefined
  >;

  for (const key of supportedAdvancedPropertyKeys) {
    const value = mergeAdvancedPropertyValue(key, left[key], right[key]);
    if (value !== undefined) {
      next[key] = value;
    }
  }

  return merged;
}

function mergeAdvancedPropertyValue(
  key: SupportedAdvancedPropertyKey,
  left: AdvancedProperties[SupportedAdvancedPropertyKey] | undefined,
  right: AdvancedProperties[SupportedAdvancedPropertyKey] | undefined,
): AdvancedProperties[SupportedAdvancedPropertyKey] | undefined {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  if (key === "Environment") {
    return [
      ...(left as NonNullable<AdvancedProperties["Environment"]>),
      ...(right as NonNullable<AdvancedProperties["Environment"]>),
    ] as AdvancedProperties[SupportedAdvancedPropertyKey];
  }

  if (key === "ReadOnlyPaths" || key === "ReadWritePaths" || key === "InaccessiblePaths") {
    return [
      ...(left as Array<{ parsed?: string[]; raw?: string }>),
      ...(right as Array<{ parsed?: string[]; raw?: string }>),
    ] as AdvancedProperties[SupportedAdvancedPropertyKey];
  }

  if (
    key === "CapabilityBoundingSet" ||
    key === "SystemCallFilter" ||
    key === "RestrictAddressFamilies"
  ) {
    return [
      ...(left as Array<{ parsed?: AdvancedListMode; raw?: string }>),
      ...(right as Array<{ parsed?: AdvancedListMode; raw?: string }>),
    ] as AdvancedProperties[SupportedAdvancedPropertyKey];
  }

  if (key === "RestrictNamespaces") {
    return [
      ...(left as Array<{ parsed?: AdvancedBooleanListMode; raw?: string }>),
      ...(right as Array<{ parsed?: AdvancedBooleanListMode; raw?: string }>),
    ] as AdvancedProperties[SupportedAdvancedPropertyKey];
  }

  return mergeOverrideProperty(
    left as { parsed?: unknown; raw?: string },
    right as {
      parsed?: unknown;
      raw?: string;
    },
  ) as AdvancedProperties[SupportedAdvancedPropertyKey];
}

function mergeOverrideProperty<T extends { parsed?: unknown; raw?: string }>(left: T, right: T): T {
  return compactParsedRawProperty({
    parsed: right.parsed ?? left.parsed,
    raw: right.raw ?? left.raw,
  }) as T;
}

function compactParsedRawProperty<T extends { parsed?: unknown; raw?: string }>(value: T): T {
  const next = {} as T;

  if (value.parsed !== undefined) {
    next.parsed = value.parsed;
  }

  if (value.raw) {
    next.raw = value.raw;
  }

  return next;
}

function parseBooleanValue(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  if (value === "yes" || value === "true" || value === "1") {
    return true;
  }

  if (value === "no" || value === "false" || value === "0") {
    return false;
  }

  return undefined;
}

function getManagedUnitFilePath(rootDir: string, unitName: string) {
  return join(rootDir, unitName);
}

function getManagedDropInDirPath(rootDir: string, unitName: string) {
  return join(rootDir, `${unitName}.d`);
}

function getSandboxdDropInPath(rootDir: string, unitName: string) {
  return join(getManagedDropInDirPath(rootDir, unitName), adoptDropInFileName);
}

function isMissingFileError(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
