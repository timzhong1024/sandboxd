import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CreateSandboxServiceInput } from "@sandboxd/core";
import { z } from "zod";
import type {
  ManagedEntityMetadataRecord,
  ManagedEntityMetadataSourcePort,
} from "../../ports/managed-entity-metadata-source-port";

const metadataRecordSchema = z.object({
  description: z.string().optional(),
  resourceControls: z.object({
    cpuWeight: z.string().optional(),
    memoryMax: z.string().optional(),
    tasksMax: z.string().optional(),
  }),
  sandboxProfile: z.string().optional(),
  sandboxing: z.object({
    noNewPrivileges: z.boolean().optional(),
    privateTmp: z.boolean().optional(),
    protectSystem: z.string().optional(),
    protectHome: z.boolean().optional(),
  }),
  slice: z.string().optional(),
  unitName: z.string(),
  workingDirectory: z.string().optional(),
});

interface CreateFilesystemMetadataSourceOptions {
  rootDir?: string;
}

export function createFilesystemMetadataSource(
  options: CreateFilesystemMetadataSourceOptions = {},
): Pick<
  ManagedEntityMetadataSourcePort,
  | "deleteManagedEntityMetadata"
  | "getManagedEntityMetadata"
  | "listManagedEntityMetadata"
  | "saveManagedEntityMetadata"
> {
  const rootDir = options.rootDir ?? getDefaultMetadataRootDir();

  async function ensureRootDir() {
    await mkdir(rootDir, { recursive: true });
  }

  return {
    async deleteManagedEntityMetadata(unitName) {
      await rm(getMetadataFilePath(rootDir, unitName), { force: true });
    },
    async getManagedEntityMetadata(unitName) {
      try {
        const raw = await readFile(getMetadataFilePath(rootDir, unitName), "utf8");
        return parseMetadataRecord(JSON.parse(raw));
      } catch (error: unknown) {
        if (isMissingFileError(error)) {
          return null;
        }

        throw error;
      }
    },
    async listManagedEntityMetadata() {
      await ensureRootDir();
      const files = await readdir(rootDir, { withFileTypes: true });
      const records = await Promise.all(
        files
          .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
          .map(async (entry) =>
            parseMetadataRecord(JSON.parse(await readFile(join(rootDir, entry.name), "utf8"))),
          ),
      );

      records.sort((left, right) => left.unitName.localeCompare(right.unitName));
      return records;
    },
    async saveManagedEntityMetadata(unitName, input: CreateSandboxServiceInput) {
      const record = createMetadataRecord({
        unitName,
        description: input.description,
        workingDirectory: input.workingDirectory,
        slice: input.slice ?? "sandboxd.slice",
        sandboxProfile: input.sandboxProfile,
        resourceControls: { ...input.resourceControls },
        sandboxing: { ...input.sandboxing },
      });

      await ensureRootDir();
      await writeFile(
        getMetadataFilePath(rootDir, unitName),
        JSON.stringify(record, null, 2),
        "utf8",
      );

      return record;
    },
  };
}

export function getDefaultMetadataRootDir(environment: NodeJS.ProcessEnv = process.env) {
  const stateDir = environment.SANDBOXD_STATE_DIR ?? "/var/lib/sandboxd";
  return join(stateDir, "managed-entities");
}

function parseMetadataRecord(input: unknown): ManagedEntityMetadataRecord {
  const parsed = metadataRecordSchema.parse(input);
  return createMetadataRecord({
    unitName: parsed.unitName,
    description: parsed.description,
    workingDirectory: parsed.workingDirectory,
    slice: parsed.slice ?? "sandboxd.slice",
    sandboxProfile: parsed.sandboxProfile,
    resourceControls: parsed.resourceControls,
    sandboxing: parsed.sandboxing,
  });
}

function createMetadataRecord(record: {
  description: string | undefined;
  resourceControls: ManagedEntityMetadataRecord["resourceControls"];
  sandboxProfile: string | undefined;
  sandboxing: ManagedEntityMetadataRecord["sandboxing"];
  slice: string;
  unitName: string;
  workingDirectory: string | undefined;
}): ManagedEntityMetadataRecord {
  return {
    unitName: record.unitName,
    slice: record.slice,
    resourceControls: record.resourceControls,
    sandboxing: record.sandboxing,
    ...(record.description ? { description: record.description } : {}),
    ...(record.workingDirectory ? { workingDirectory: record.workingDirectory } : {}),
    ...(record.sandboxProfile ? { sandboxProfile: record.sandboxProfile } : {}),
  };
}

function getMetadataFilePath(rootDir: string, unitName: string) {
  return join(rootDir, `${encodeUnitName(unitName)}.json`);
}

function encodeUnitName(unitName: string) {
  return unitName.replaceAll("/", "_").replaceAll(".", "_");
}

function isMissingFileError(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
