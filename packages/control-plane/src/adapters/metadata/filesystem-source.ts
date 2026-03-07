import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CreateSandboxServiceInput, DangerousAdoptManagedEntityInput } from "@sandboxd/core";
import { z } from "zod";
import type {
  ManagedEntityMetadataRecord,
  ManagedEntityMetadataSourcePort,
} from "../../ports/managed-entity-metadata-source-port";

const managedSectionName = "X-Sandboxd";
const adoptDropInFileName = "90-sandboxd-owned.conf";

const sandboxdMetadataSchema = z.object({
  owned: z.boolean().optional(),
  sandboxProfile: z.string().optional(),
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
> {
  const rootDir = options.rootDir ?? getDefaultMetadataRootDir();
  const getManagedMetadataForUnit = async (unitName: string) => {
    const metadata = await readSandboxdMetadata(rootDir, unitName);
    if (!metadata?.owned) {
      return null;
    }

    return createMetadataRecord({
      unitName,
      sandboxProfile: metadata.sandboxProfile,
    });
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
    async saveManagedEntityMetadata(unitName, input: CreateSandboxServiceInput) {
      const record = createMetadataRecord({
        unitName,
        sandboxProfile: input.sandboxProfile,
      });

      await writeSandboxdDropIn(rootDir, unitName, {
        sandboxProfile: input.sandboxProfile,
      });

      return record;
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
  sandboxProfile: string | undefined;
  unitName: string;
}): ManagedEntityMetadataRecord {
  return {
    unitName: record.unitName,
    resourceControls: {},
    sandboxing: {},
    ...(record.sandboxProfile ? { sandboxProfile: record.sandboxProfile } : {}),
  };
}

async function readSandboxdMetadata(rootDir: string, unitName: string) {
  const texts = await Promise.all(
    [getManagedUnitFilePath(rootDir, unitName), ...(await listDropInFiles(rootDir, unitName))].map(
      (path) => readTextIfPresent(path),
    ),
  );

  const merged = texts.reduce<Record<string, string>>((result, text) => {
    if (!text) {
      return result;
    }

    return {
      ...result,
      ...parseSandboxdDirectiveMap(text),
    };
  }, {});

  return sandboxdMetadataSchema.parse({
    owned: parseBooleanValue(merged.Owned ?? merged["X-Sandboxd-Owned"]),
    sandboxProfile: merged.Profile ?? merged["X-Sandboxd-Profile"],
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

function parseSandboxdDirectiveMap(text: string) {
  const values: Record<string, string> = {};
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
      values[key] = value;
    }
  }

  return values;
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
