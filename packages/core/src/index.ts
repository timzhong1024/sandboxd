import { z } from "zod";

export const managedEntityKindSchema = z.enum([
  "systemd-unit",
  "sandbox-service",
  "container",
  "vm",
]);

export const managedEntityOriginSchema = z.enum(["external", "sandboxd"]);

export const managedEntityCapabilitiesSchema = z.object({
  canInspect: z.boolean(),
  canStart: z.boolean(),
  canStop: z.boolean(),
  canRestart: z.boolean(),
});

export const resourceControlsSchema = z.object({
  cpuWeight: z.string().optional(),
  memoryMax: z.string().optional(),
  tasksMax: z.string().optional(),
});

export const sandboxingSchema = z.object({
  noNewPrivileges: z.boolean().optional(),
  privateTmp: z.boolean().optional(),
  protectSystem: z.string().optional(),
  protectHome: z.boolean().optional(),
});

export const sandboxProfileSchema = z.enum(["baseline", "strict"]);

export const profileSandboxingPropertyKeySchema = z.enum([
  "NoNewPrivileges",
  "PrivateTmp",
  "ProtectSystem",
  "ProtectHome",
]);

const validationScopeSchema = z.enum(["entity", "property"]);
const validationLevelSchema = z.enum(["error", "warning"]);
const validationPropertyKeySchema = z.string();
const profileDriftStatusSchema = z.enum(["matched", "overridden", "extra", "unknown"]);
const comparableConfigValueSchema = z.union([z.string(), z.boolean(), z.null()]);

export const validationIssueSchema = z.object({
  code: z.string(),
  level: validationLevelSchema,
  message: z.string(),
  scope: validationScopeSchema,
  propertyKey: validationPropertyKeySchema.optional(),
});

export const validationResultSchema = z.object({
  errors: z.array(validationIssueSchema),
  warnings: z.array(validationIssueSchema),
  readonly: z.boolean(),
  readonlyReasons: z.array(z.string()),
});

export const profileDriftItemSchema = z.object({
  property: profileSandboxingPropertyKeySchema,
  expected: comparableConfigValueSchema,
  actual: comparableConfigValueSchema,
  status: profileDriftStatusSchema,
});

export const profileMappingSchema = z.object({
  profile: sandboxProfileSchema.optional(),
  profileDefaults: sandboxingSchema,
  effectiveSandboxing: sandboxingSchema,
  driftItems: z.array(profileDriftItemSchema),
});

export const managedEntitySummarySchema = z.object({
  kind: managedEntityKindSchema,
  origin: managedEntityOriginSchema,
  unitName: z.string(),
  unitType: z.string(),
  state: z.string(),
  subState: z.string().optional(),
  loadState: z.string().optional(),
  slice: z.string().optional(),
  description: z.string().optional(),
  sandboxProfile: sandboxProfileSchema.optional(),
  resourceControls: resourceControlsSchema.optional(),
  sandboxing: sandboxingSchema.optional(),
  labels: z.record(z.string(), z.string()),
  capabilities: managedEntityCapabilitiesSchema,
});

export const advancedPropertyGroupSchema = z.enum([
  "filesystem",
  "privilege",
  "isolation",
  "syscall",
  "network",
  "resource",
  "process",
]);

export const advancedPropertyLevelSchema = z.enum([
  "recommended",
  "advanced",
  "expert",
  "dangerous",
]);

export const advancedPropertyValueTypeSchema = z.enum([
  "boolean",
  "enum",
  "path-list",
  "string-list",
  "mode-list",
  "path",
  "environment",
  "cpu-weight",
  "size-limit",
  "count-limit",
]);

export const supportedAdvancedPropertyKeySchema = z.enum([
  "ProtectSystem",
  "ProtectHome",
  "PrivateTmp",
  "ReadOnlyPaths",
  "ReadWritePaths",
  "InaccessiblePaths",
  "NoNewPrivileges",
  "CapabilityBoundingSet",
  "PrivateDevices",
  "PrivateUsers",
  "PrivateNetwork",
  "RestrictNamespaces",
  "SystemCallFilter",
  "RestrictAddressFamilies",
  "CPUWeight",
  "MemoryMax",
  "TasksMax",
  "WorkingDirectory",
  "Environment",
]);

export const rawDirectiveValueSchema = z.string();
export const rawDirectiveValuesSchema = z.array(rawDirectiveValueSchema).min(1);

function createParsedRawPropertySchema<T extends z.ZodTypeAny>(parsedSchema: T) {
  return z
    .object({
      parsed: parsedSchema.optional(),
      raw: rawDirectiveValueSchema.optional(),
    })
    .refine((value) => value.parsed !== undefined || value.raw !== undefined, {
      message: "Expected either parsed or raw advanced property content",
    });
}

function createParsedRawPropertyListSchema<T extends z.ZodTypeAny>(parsedSchema: T) {
  return z.array(createParsedRawPropertySchema(parsedSchema)).min(1);
}

export const advancedListModeSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("allow"),
    values: z.array(z.string()),
  }),
  z.object({
    mode: z.literal("deny"),
    values: z.array(z.string()),
  }),
  z.object({
    mode: z.literal("reset"),
  }),
]);

export const advancedBooleanListModeSchema = z.discriminatedUnion("mode", [
  ...advancedListModeSchema.options,
  z.object({
    mode: z.literal("boolean"),
    value: z.boolean(),
  }),
]);

export const cpuWeightValueSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("idle"),
  }),
  z.object({
    kind: z.literal("value"),
    value: z.number().int().min(1).max(10_000),
  }),
]);

export const sizeLimitValueSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("infinity"),
  }),
  z.object({
    kind: z.literal("percentage"),
    value: z.number().min(0).max(100),
  }),
  z.object({
    kind: z.literal("size"),
    value: z.string().min(1),
  }),
]);

export const countLimitValueSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("infinity"),
  }),
  z.object({
    kind: z.literal("percentage"),
    value: z.number().min(0).max(100),
  }),
  z.object({
    kind: z.literal("count"),
    value: z.number().int().min(0),
  }),
]);

export const environmentValueSchema = z.object({
  parsed: z.record(z.string(), z.string()).optional(),
  raw: rawDirectiveValueSchema.optional(),
});

export const advancedPropertiesSchema = z.object({
  ProtectSystem: createParsedRawPropertySchema(
    z.union([z.boolean(), z.enum(["full", "strict"])]),
  ).optional(),
  ProtectHome: createParsedRawPropertySchema(
    z.union([z.boolean(), z.enum(["read-only", "tmpfs"])]),
  ).optional(),
  PrivateTmp: createParsedRawPropertySchema(
    z.union([z.boolean(), z.literal("disconnected")]),
  ).optional(),
  ReadOnlyPaths: createParsedRawPropertyListSchema(z.array(z.string())).optional(),
  ReadWritePaths: createParsedRawPropertyListSchema(z.array(z.string())).optional(),
  InaccessiblePaths: createParsedRawPropertyListSchema(z.array(z.string())).optional(),
  NoNewPrivileges: createParsedRawPropertySchema(z.boolean()).optional(),
  CapabilityBoundingSet: createParsedRawPropertyListSchema(advancedListModeSchema).optional(),
  PrivateDevices: createParsedRawPropertySchema(z.boolean()).optional(),
  PrivateUsers: createParsedRawPropertySchema(z.boolean()).optional(),
  PrivateNetwork: createParsedRawPropertySchema(z.boolean()).optional(),
  RestrictNamespaces: createParsedRawPropertyListSchema(advancedBooleanListModeSchema).optional(),
  SystemCallFilter: createParsedRawPropertyListSchema(advancedListModeSchema).optional(),
  RestrictAddressFamilies: createParsedRawPropertyListSchema(advancedListModeSchema).optional(),
  CPUWeight: createParsedRawPropertySchema(cpuWeightValueSchema).optional(),
  MemoryMax: createParsedRawPropertySchema(sizeLimitValueSchema).optional(),
  TasksMax: createParsedRawPropertySchema(countLimitValueSchema).optional(),
  WorkingDirectory: createParsedRawPropertySchema(z.string()).optional(),
  Environment: z.array(environmentValueSchema).min(1).optional(),
});

export const unknownSystemdDirectiveSourceSchema = z.enum(["unit-file", "drop-in"]);

export const unknownSystemdDirectiveSchema = z.object({
  section: z.string(),
  key: z.string(),
  value: z.string(),
  source: unknownSystemdDirectiveSourceSchema,
});

export const advancedPropertySpecSchema = z.object({
  key: supportedAdvancedPropertyKeySchema,
  title: z.string(),
  group: advancedPropertyGroupSchema,
  level: advancedPropertyLevelSchema,
  valueType: advancedPropertyValueTypeSchema,
  description: z.string(),
  supportsRawFallback: z.boolean(),
  supportedModes: z.array(z.enum(["allow", "deny", "reset", "boolean"])).optional(),
  supportStatus: z.enum(["inspect-only", "editable-in-phase-2"]),
});

export const advancedPropertyGroupSpecSchema = z.object({
  key: advancedPropertyGroupSchema,
  title: z.string(),
  description: z.string(),
});

export const managedEntityStatusSchema = z.object({
  activeState: z.string(),
  subState: z.string(),
  loadState: z.string(),
});

export const managedEntityDetailSchema = managedEntitySummarySchema.extend({
  resourceControls: resourceControlsSchema,
  sandboxing: sandboxingSchema,
  advancedProperties: advancedPropertiesSchema.optional(),
  unknownSystemdDirectives: z.array(unknownSystemdDirectiveSchema).optional(),
  profileMapping: profileMappingSchema.optional(),
  status: managedEntityStatusSchema,
  validation: validationResultSchema.optional(),
});

export const createSandboxServiceInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  execStart: z.string().min(1),
  workingDirectory: z.string().optional(),
  environment: z.record(z.string(), z.string()).optional(),
  slice: z.string().optional(),
  sandboxProfile: sandboxProfileSchema.optional(),
  resourceControls: resourceControlsSchema.optional(),
  sandboxing: sandboxingSchema.optional(),
  advancedProperties: advancedPropertiesSchema.optional(),
});

export const dangerousAdoptManagedEntityInputSchema = z.object({
  sandboxProfile: sandboxProfileSchema.optional(),
});

export const managedEntitySummariesSchema = z.array(managedEntitySummarySchema);

export const systemdUnitRecordSchema = z.object({
  unitName: z.string(),
  loadState: z.string(),
  activeState: z.string(),
  subState: z.string(),
  description: z.string(),
  slice: z.string().optional(),
});

export const systemdUnitDetailRecordSchema = systemdUnitRecordSchema.extend({
  fragmentPath: z.string().optional(),
  unitFileState: z.string().optional(),
  resourceControls: resourceControlsSchema.optional(),
  sandboxing: sandboxingSchema.optional(),
  advancedProperties: advancedPropertiesSchema.optional(),
  unknownSystemdDirectives: z.array(unknownSystemdDirectiveSchema).optional(),
});

export const systemdUnitRecordsSchema = z.array(systemdUnitRecordSchema);

export type ManagedEntityKind = z.infer<typeof managedEntityKindSchema>;
export type ManagedEntityOrigin = z.infer<typeof managedEntityOriginSchema>;
export type ManagedEntityCapabilities = z.infer<typeof managedEntityCapabilitiesSchema>;
export type ManagedEntitySummary = z.infer<typeof managedEntitySummarySchema>;
export type ManagedEntityDetail = z.infer<typeof managedEntityDetailSchema>;
export type ManagedEntityStatus = z.infer<typeof managedEntityStatusSchema>;
export type ResourceControls = z.infer<typeof resourceControlsSchema>;
export type Sandboxing = z.infer<typeof sandboxingSchema>;
export type SandboxProfile = z.infer<typeof sandboxProfileSchema>;
export type ProfileSandboxingPropertyKey = z.infer<typeof profileSandboxingPropertyKeySchema>;
export type AdvancedPropertyGroup = z.infer<typeof advancedPropertyGroupSchema>;
export type AdvancedPropertyLevel = z.infer<typeof advancedPropertyLevelSchema>;
export type AdvancedPropertyValueType = z.infer<typeof advancedPropertyValueTypeSchema>;
export type SupportedAdvancedPropertyKey = z.infer<typeof supportedAdvancedPropertyKeySchema>;
export type AdvancedListMode = z.infer<typeof advancedListModeSchema>;
export type AdvancedBooleanListMode = z.infer<typeof advancedBooleanListModeSchema>;
export type CpuWeightValue = z.infer<typeof cpuWeightValueSchema>;
export type SizeLimitValue = z.infer<typeof sizeLimitValueSchema>;
export type CountLimitValue = z.infer<typeof countLimitValueSchema>;
export type AdvancedProperties = z.infer<typeof advancedPropertiesSchema>;
export type UnknownSystemdDirective = z.infer<typeof unknownSystemdDirectiveSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type ProfileDriftItem = z.infer<typeof profileDriftItemSchema>;
export type ProfileMapping = z.infer<typeof profileMappingSchema>;
export type AdvancedPropertySpec = z.infer<typeof advancedPropertySpecSchema>;
export type AdvancedPropertyGroupSpec = z.infer<typeof advancedPropertyGroupSpecSchema>;
export type CreateSandboxServiceInput = z.infer<typeof createSandboxServiceInputSchema>;
export type DangerousAdoptManagedEntityInput = z.infer<
  typeof dangerousAdoptManagedEntityInputSchema
>;
export type SystemdUnitRecord = z.infer<typeof systemdUnitRecordSchema>;
export type SystemdUnitDetailRecord = z.infer<typeof systemdUnitDetailRecordSchema>;

export const supportedAdvancedPropertySpecs = [
  {
    key: "ProtectSystem",
    title: "ProtectSystem",
    group: "filesystem",
    level: "recommended",
    valueType: "enum",
    description: "Restrict writes to core system directories.",
    supportsRawFallback: true,
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "ProtectHome",
    title: "ProtectHome",
    group: "filesystem",
    level: "recommended",
    valueType: "enum",
    description: "Limit access to user home directories.",
    supportsRawFallback: true,
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "PrivateTmp",
    title: "PrivateTmp",
    group: "filesystem",
    level: "recommended",
    valueType: "enum",
    description: "Give the service a private /tmp and /var/tmp namespace.",
    supportsRawFallback: true,
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "ReadOnlyPaths",
    title: "ReadOnlyPaths",
    group: "filesystem",
    level: "advanced",
    valueType: "path-list",
    description: "Mount selected paths read-only for the service.",
    supportsRawFallback: true,
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "ReadWritePaths",
    title: "ReadWritePaths",
    group: "filesystem",
    level: "advanced",
    valueType: "path-list",
    description: "Allow writes only to selected paths when broader FS protections are active.",
    supportsRawFallback: true,
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "InaccessiblePaths",
    title: "InaccessiblePaths",
    group: "filesystem",
    level: "advanced",
    valueType: "path-list",
    description: "Hide selected filesystem paths from the service.",
    supportsRawFallback: true,
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "NoNewPrivileges",
    title: "NoNewPrivileges",
    group: "privilege",
    level: "recommended",
    valueType: "boolean",
    description: "Prevent the service and its children from gaining new privileges.",
    supportsRawFallback: true,
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "CapabilityBoundingSet",
    title: "CapabilityBoundingSet",
    group: "privilege",
    level: "expert",
    valueType: "mode-list",
    description: "Limit Linux capabilities available to the service.",
    supportsRawFallback: true,
    supportedModes: ["allow", "deny", "reset"],
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "PrivateDevices",
    title: "PrivateDevices",
    group: "isolation",
    level: "recommended",
    valueType: "boolean",
    description: "Hide most host device nodes and provide a private minimal /dev.",
    supportsRawFallback: true,
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "PrivateUsers",
    title: "PrivateUsers",
    group: "isolation",
    level: "advanced",
    valueType: "boolean",
    description: "Run the service in a private user namespace.",
    supportsRawFallback: true,
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "PrivateNetwork",
    title: "PrivateNetwork",
    group: "isolation",
    level: "advanced",
    valueType: "boolean",
    description: "Run the service in a private network namespace.",
    supportsRawFallback: true,
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "RestrictNamespaces",
    title: "RestrictNamespaces",
    group: "isolation",
    level: "expert",
    valueType: "mode-list",
    description: "Limit which Linux namespace types the service may create.",
    supportsRawFallback: true,
    supportedModes: ["allow", "deny", "reset", "boolean"],
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "SystemCallFilter",
    title: "SystemCallFilter",
    group: "syscall",
    level: "expert",
    valueType: "mode-list",
    description: "Allow or deny selected syscall groups and names.",
    supportsRawFallback: true,
    supportedModes: ["allow", "deny", "reset"],
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "RestrictAddressFamilies",
    title: "RestrictAddressFamilies",
    group: "network",
    level: "advanced",
    valueType: "mode-list",
    description: "Limit socket address families available to the service.",
    supportsRawFallback: true,
    supportedModes: ["allow", "deny", "reset"],
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "CPUWeight",
    title: "CPUWeight",
    group: "resource",
    level: "recommended",
    valueType: "cpu-weight",
    description: "Relative CPU scheduling weight for the service cgroup.",
    supportsRawFallback: true,
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "MemoryMax",
    title: "MemoryMax",
    group: "resource",
    level: "recommended",
    valueType: "size-limit",
    description: "Hard memory limit for the service cgroup.",
    supportsRawFallback: true,
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "TasksMax",
    title: "TasksMax",
    group: "resource",
    level: "recommended",
    valueType: "count-limit",
    description: "Maximum number of tasks allowed for the service.",
    supportsRawFallback: true,
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "WorkingDirectory",
    title: "WorkingDirectory",
    group: "process",
    level: "recommended",
    valueType: "path",
    description: "Working directory before the service starts.",
    supportsRawFallback: true,
    supportStatus: "editable-in-phase-2",
  },
  {
    key: "Environment",
    title: "Environment",
    group: "process",
    level: "advanced",
    valueType: "environment",
    description: "Environment variables injected into the service process.",
    supportsRawFallback: true,
    supportStatus: "editable-in-phase-2",
  },
] as const satisfies ReadonlyArray<AdvancedPropertySpec>;

export const supportedAdvancedPropertyGroupSpecs = [
  {
    key: "filesystem",
    title: "Filesystem",
    description: "Filesystem exposure, writable exceptions, and path visibility controls.",
  },
  {
    key: "privilege",
    title: "Privilege",
    description: "Privilege reduction, capability bounding, and execution hardening controls.",
  },
  {
    key: "isolation",
    title: "Isolation",
    description: "Namespace isolation for users, devices, and network access.",
  },
  {
    key: "syscall",
    title: "System Call",
    description: "System call allow or deny filters applied to the service process.",
  },
  {
    key: "network",
    title: "Network",
    description: "Network-related restrictions such as allowed socket address families.",
  },
  {
    key: "resource",
    title: "Resource",
    description: "Resource control values applied to the unit cgroup.",
  },
  {
    key: "process",
    title: "Process",
    description: "Process start-up context such as working directory and environment.",
  },
] as const satisfies ReadonlyArray<AdvancedPropertyGroupSpec>;

export const supportedAdvancedPropertyKeys = supportedAdvancedPropertySpecs.map(
  (spec) => spec.key,
) as ReadonlyArray<SupportedAdvancedPropertyKey>;

const protectSystemDirectiveSchema = z
  .string()
  .transform((value) => parseBooleanEnumDirective(value, ["full", "strict"] as const));

const protectHomeDirectiveSchema = z
  .string()
  .transform((value) => parseBooleanEnumDirective(value, ["read-only", "tmpfs"] as const));

const privateTmpDirectiveSchema = z
  .string()
  .transform((value) => parseBooleanEnumDirective(value, ["disconnected"] as const));

const booleanDirectiveSchema = z.string().transform((value) => {
  const parsed = parseDirectiveBoolean(value);
  return parsed === undefined ? { raw: value } : { parsed };
});

const repeatedStringListDirectiveSchema = z.string().transform((value) => [
  {
    parsed: splitDirectiveValue(value),
  },
]);

const modeListDirectiveSchema = z.string().transform((value) => parseModeListDirective(value));

const booleanModeListDirectiveSchema = z
  .string()
  .transform((value) => parseBooleanModeListDirective(value));

const cpuWeightDirectiveSchema = z.string().transform((value) => parseCpuWeightDirective(value));

const sizeLimitDirectiveSchema = z.string().transform((value) => parseSizeLimitDirective(value));

const countLimitDirectiveSchema = z.string().transform((value) => parseCountLimitDirective(value));

const workingDirectoryDirectiveSchema = z.string().transform((value) => ({
  parsed: value,
}));

const environmentDirectiveSchema = z
  .string()
  .transform((value) => parseEnvironmentDirective(value));

const advancedPropertyDirectiveParsers = {
  ProtectSystem: protectSystemDirectiveSchema,
  ProtectHome: protectHomeDirectiveSchema,
  PrivateTmp: privateTmpDirectiveSchema,
  ReadOnlyPaths: repeatedStringListDirectiveSchema,
  ReadWritePaths: repeatedStringListDirectiveSchema,
  InaccessiblePaths: repeatedStringListDirectiveSchema,
  NoNewPrivileges: booleanDirectiveSchema,
  CapabilityBoundingSet: modeListDirectiveSchema,
  PrivateDevices: booleanDirectiveSchema,
  PrivateUsers: booleanDirectiveSchema,
  PrivateNetwork: booleanDirectiveSchema,
  RestrictNamespaces: booleanModeListDirectiveSchema,
  SystemCallFilter: modeListDirectiveSchema,
  RestrictAddressFamilies: modeListDirectiveSchema,
  CPUWeight: cpuWeightDirectiveSchema,
  MemoryMax: sizeLimitDirectiveSchema,
  TasksMax: countLimitDirectiveSchema,
  WorkingDirectory: workingDirectoryDirectiveSchema,
  Environment: environmentDirectiveSchema,
} as const satisfies Record<SupportedAdvancedPropertyKey, z.ZodTypeAny>;

export function parseAdvancedPropertyDirective<K extends SupportedAdvancedPropertyKey>(
  key: K,
  value: string,
): AdvancedProperties[K] {
  return advancedPropertyDirectiveParsers[key].parse(value) as AdvancedProperties[K];
}

function parseBooleanEnumDirective<const TValues extends readonly string[]>(
  value: string,
  allowedValues: TValues,
) {
  const parsedBoolean = parseDirectiveBoolean(value);
  if (parsedBoolean !== undefined) {
    return {
      parsed: parsedBoolean,
    };
  }

  const enumSchema = z.enum(allowedValues);
  const parsedEnum = enumSchema.safeParse(value);
  if (parsedEnum.success) {
    return {
      parsed: parsedEnum.data,
    };
  }

  return {
    raw: value,
  };
}

function parseModeListDirective(value: string): Array<{ parsed?: AdvancedListMode; raw?: string }> {
  const trimmed = value.trim();
  if (trimmed === "") {
    return [
      {
        parsed: {
          mode: "reset",
        },
      },
    ];
  }

  const deny = trimmed.startsWith("~");
  const values = splitDirectiveValue(deny ? trimmed.slice(1) : trimmed);
  if (values.length === 0 || values.some((item) => item.startsWith("~"))) {
    return [{ raw: value }];
  }

  return [
    {
      parsed: {
        mode: deny ? "deny" : "allow",
        values,
      },
    },
  ];
}

function parseBooleanModeListDirective(value: string): {
  parsed?: AdvancedBooleanListMode;
  raw?: string;
}[] {
  const parsedBoolean = parseDirectiveBoolean(value);
  if (parsedBoolean !== undefined) {
    return [
      {
        parsed: {
          mode: "boolean",
          value: parsedBoolean,
        },
      },
    ];
  }

  return parseModeListDirective(value);
}

function parseCpuWeightDirective(value: string): { parsed?: CpuWeightValue; raw?: string } {
  const trimmed = value.trim();
  if (trimmed === "idle") {
    return {
      parsed: {
        kind: "idle",
      },
    };
  }

  if (!/^\d+$/.test(trimmed)) {
    return {
      raw: value,
    };
  }

  const numericValue = Number.parseInt(trimmed, 10);
  const parsed = cpuWeightValueSchema.safeParse({
    kind: "value",
    value: numericValue,
  });
  if (parsed.success && Number.isInteger(numericValue)) {
    return {
      parsed: parsed.data,
    };
  }

  return {
    raw: value,
  };
}

function parseSizeLimitDirective(value: string): { parsed?: SizeLimitValue; raw?: string } {
  const trimmed = value.trim();
  if (trimmed === "infinity") {
    return {
      parsed: {
        kind: "infinity",
      },
    };
  }

  if (/^\d+%$/.test(trimmed)) {
    return {
      parsed: {
        kind: "percentage",
        value: Number.parseInt(trimmed.slice(0, -1), 10),
      },
    };
  }

  if (trimmed.length > 0) {
    return {
      parsed: {
        kind: "size",
        value: trimmed,
      },
    };
  }

  return {
    raw: value,
  };
}

function parseCountLimitDirective(value: string): { parsed?: CountLimitValue; raw?: string } {
  const trimmed = value.trim();
  if (trimmed === "infinity") {
    return {
      parsed: {
        kind: "infinity",
      },
    };
  }

  if (/^\d+%$/.test(trimmed)) {
    return {
      parsed: {
        kind: "percentage",
        value: Number.parseInt(trimmed.slice(0, -1), 10),
      },
    };
  }

  if (/^\d+$/.test(trimmed)) {
    return {
      parsed: {
        kind: "count",
        value: Number.parseInt(trimmed, 10),
      },
    };
  }

  return {
    raw: value,
  };
}

function parseEnvironmentDirective(value: string) {
  const assignments = splitQuotedDirectiveValue(value);
  if (!assignments) {
    return [{ raw: value }];
  }

  const parsed: Record<string, string> = {};
  for (const assignment of assignments) {
    const separatorIndex = assignment.indexOf("=");
    if (separatorIndex <= 0) {
      return [{ raw: value }];
    }

    parsed[assignment.slice(0, separatorIndex)] = assignment.slice(separatorIndex + 1);
  }

  return [{ parsed }];
}

function splitDirectiveValue(value: string) {
  return value
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitQuotedDirectiveValue(value: string) {
  const items: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quote) {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (current) {
        items.push(current);
        current = "";
      }
      continue;
    }

    current += character;
  }

  if (escaped || quote) {
    return null;
  }

  if (current) {
    items.push(current);
  }

  return items;
}

function parseDirectiveBoolean(value: string | undefined) {
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

const profileSandboxingBindings = [
  {
    property: "NoNewPrivileges",
    advancedKey: "NoNewPrivileges",
    sandboxingKey: "noNewPrivileges",
  },
  {
    property: "PrivateTmp",
    advancedKey: "PrivateTmp",
    sandboxingKey: "privateTmp",
  },
  {
    property: "ProtectSystem",
    advancedKey: "ProtectSystem",
    sandboxingKey: "protectSystem",
  },
  {
    property: "ProtectHome",
    advancedKey: "ProtectHome",
    sandboxingKey: "protectHome",
  },
] as const satisfies ReadonlyArray<{
  advancedKey: "NoNewPrivileges" | "PrivateTmp" | "ProtectSystem" | "ProtectHome";
  property: ProfileSandboxingPropertyKey;
  sandboxingKey: keyof Sandboxing;
}>;

interface ManagedEntityValidationInput {
  advancedProperties?: AdvancedProperties;
  environment?: Record<string, string>;
  resourceControls?: ResourceControls;
  sandboxProfile?: SandboxProfile;
  sandboxing?: Sandboxing;
  unknownSystemdDirectives?: UnknownSystemdDirective[];
  workingDirectory?: string;
}

export function getSandboxProfileDefaults(profile: SandboxProfile | undefined): Sandboxing {
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

export function validateManagedEntityConfig(input: ManagedEntityValidationInput): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const readonlyReasons: string[] = [];

  for (const binding of profileSandboxingBindings) {
    if (input.sandboxProfile && input.sandboxing?.[binding.sandboxingKey] !== undefined) {
      warnings.push({
        code: "profile-override",
        level: "warning",
        message: `${binding.property} overrides the selected sandbox profile default.`,
        propertyKey: binding.property,
        scope: "property",
      });
    }
  }

  const duplicates = [
    {
      actual: input.resourceControls?.cpuWeight,
      advanced: input.advancedProperties?.CPUWeight,
      propertyKey: "CPUWeight",
    },
    {
      actual: input.resourceControls?.memoryMax,
      advanced: input.advancedProperties?.MemoryMax,
      propertyKey: "MemoryMax",
    },
    {
      actual: input.resourceControls?.tasksMax,
      advanced: input.advancedProperties?.TasksMax,
      propertyKey: "TasksMax",
    },
    {
      actual: input.sandboxing?.noNewPrivileges,
      advanced: input.advancedProperties?.NoNewPrivileges,
      propertyKey: "NoNewPrivileges",
    },
    {
      actual: input.sandboxing?.privateTmp,
      advanced: input.advancedProperties?.PrivateTmp,
      propertyKey: "PrivateTmp",
    },
    {
      actual: input.sandboxing?.protectSystem,
      advanced: input.advancedProperties?.ProtectSystem,
      propertyKey: "ProtectSystem",
    },
    {
      actual: input.sandboxing?.protectHome,
      advanced: input.advancedProperties?.ProtectHome,
      propertyKey: "ProtectHome",
    },
    {
      actual: input.workingDirectory,
      advanced: input.advancedProperties?.WorkingDirectory,
      propertyKey: "WorkingDirectory",
    },
    {
      actual: input.environment,
      advanced: input.advancedProperties?.Environment,
      propertyKey: "Environment",
    },
  ] as const;

  for (const duplicate of duplicates) {
    if (
      duplicate.actual !== undefined &&
      duplicate.actual !== null &&
      hasConfiguredAdvancedValue(duplicate.advanced)
    ) {
      errors.push({
        code: "duplicate-expression",
        level: "error",
        message: `${duplicate.propertyKey} is configured through more than one field.`,
        propertyKey: duplicate.propertyKey,
        scope: "property",
      });
    }
  }

  const rawAdvancedKeys = listRawAdvancedPropertyKeys(input.advancedProperties);
  for (const propertyKey of rawAdvancedKeys) {
    warnings.push({
      code: "raw-advanced-property",
      level: "warning",
      message: `${propertyKey} contains raw content and cannot be safely round-tripped.`,
      propertyKey,
      scope: "property",
    });
  }
  if (rawAdvancedKeys.length > 0) {
    readonlyReasons.push(
      "Contains raw advanced systemd directives that sandboxd cannot safely rewrite.",
    );
  }

  if ((input.unknownSystemdDirectives?.length ?? 0) > 0) {
    warnings.push({
      code: "unknown-systemd-directive",
      level: "warning",
      message: "Unsupported systemd directives were detected and the entity remains inspect-only.",
      scope: "entity",
    });
    readonlyReasons.push(
      "Contains unsupported systemd directives that sandboxd cannot safely preserve during updates.",
    );
  }

  return {
    errors,
    warnings,
    readonly: readonlyReasons.length > 0,
    readonlyReasons,
  };
}

export function buildProfileMapping(
  detail: Pick<ManagedEntityDetail, "advancedProperties" | "sandboxProfile" | "sandboxing">,
): ProfileMapping {
  const profileDefaults = getSandboxProfileDefaults(detail.sandboxProfile);
  const effectiveSandboxing = {
    ...profileDefaults,
    ...detail.sandboxing,
  };
  const driftItems = profileSandboxingBindings.map((binding) => {
    const expected = toComparableConfigValue(profileDefaults[binding.sandboxingKey]);
    const actual = getComparableEffectiveValue(
      detail.advancedProperties?.[binding.advancedKey],
      effectiveSandboxing[binding.sandboxingKey],
    );

    return {
      property: binding.property,
      expected,
      actual,
      status: resolveProfileDriftStatus(expected, actual),
    } satisfies ProfileDriftItem;
  });

  return {
    profile: detail.sandboxProfile,
    profileDefaults,
    effectiveSandboxing,
    driftItems,
  };
}

export function enrichManagedEntityDetail(detail: ManagedEntityDetail): ManagedEntityDetail {
  return {
    ...detail,
    profileMapping: buildProfileMapping(detail),
    validation: validateManagedEntityConfig(detail),
  };
}

function resolveProfileDriftStatus(
  expected: ProfileDriftItem["expected"],
  actual: ProfileDriftItem["actual"],
): ProfileDriftItem["status"] {
  if (actual === null && expected === null) {
    return "matched";
  }

  if (actual === null) {
    return "unknown";
  }

  if (expected === null) {
    return "extra";
  }

  return expected === actual ? "matched" : "overridden";
}

function getComparableEffectiveValue(
  advancedValue:
    | AdvancedProperties["NoNewPrivileges"]
    | AdvancedProperties["PrivateTmp"]
    | AdvancedProperties["ProtectSystem"]
    | AdvancedProperties["ProtectHome"]
    | undefined,
  fallbackValue: string | boolean | undefined,
) {
  if (advancedValue?.raw !== undefined) {
    return null;
  }

  if (advancedValue?.parsed !== undefined) {
    return toComparableConfigValue(advancedValue.parsed);
  }

  return toComparableConfigValue(fallbackValue);
}

function toComparableConfigValue(value: unknown): string | boolean | null {
  if (typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  return null;
}

function hasConfiguredAdvancedValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return value !== undefined;
}

function listRawAdvancedPropertyKeys(advancedProperties: AdvancedProperties | undefined) {
  if (!advancedProperties) {
    return [] as SupportedAdvancedPropertyKey[];
  }

  return supportedAdvancedPropertyKeys.filter((key) => {
    const value = advancedProperties[key];
    if (!value) {
      return false;
    }

    if (Array.isArray(value)) {
      return value.some((entry) => entry.raw !== undefined);
    }

    return typeof value === "object" && value !== null && "raw" in value && value.raw !== undefined;
  });
}

export function isSandboxdManaged(entity: ManagedEntitySummary | ManagedEntityDetail) {
  return entity.origin === "sandboxd";
}

export function getUnitType(unitName: string) {
  const separatorIndex = unitName.lastIndexOf(".");
  if (separatorIndex === -1 || separatorIndex === unitName.length - 1) {
    return "unknown";
  }

  return unitName.slice(separatorIndex + 1);
}

export function getManagedEntityCapabilities(
  entity: Pick<ManagedEntitySummary, "origin" | "state">,
): ManagedEntityCapabilities {
  const sandboxdManaged = entity.origin === "sandboxd";
  const active = entity.state === "active";

  return {
    canInspect: true,
    canStart: sandboxdManaged && !active,
    canStop: sandboxdManaged && active,
    canRestart: sandboxdManaged && active,
  };
}

export function mapSystemdUnitRecord(record: SystemdUnitRecord): ManagedEntitySummary {
  const summary: ManagedEntitySummary = {
    kind: "systemd-unit",
    origin: "external",
    unitName: record.unitName,
    unitType: getUnitType(record.unitName),
    state: record.activeState,
    subState: record.subState,
    loadState: record.loadState,
    slice: record.slice,
    description: record.description,
    resourceControls: {},
    sandboxing: {},
    labels: {},
    capabilities: getManagedEntityCapabilities({
      origin: "external",
      state: record.activeState,
    }),
  };

  return summary;
}

export function mapSystemdUnitDetailRecord(record: SystemdUnitDetailRecord): ManagedEntityDetail {
  const summary = mapSystemdUnitRecord(record);

  return enrichManagedEntityDetail({
    ...summary,
    resourceControls: record.resourceControls ?? {},
    sandboxing: record.sandboxing ?? {},
    advancedProperties: record.advancedProperties ?? {},
    unknownSystemdDirectives: record.unknownSystemdDirectives ?? [],
    status: {
      activeState: record.activeState,
      subState: record.subState,
      loadState: record.loadState,
    },
  });
}

export function parseManagedEntitySummaries(input: unknown): ManagedEntitySummary[] {
  return managedEntitySummariesSchema.parse(input);
}

export function parseManagedEntitySummary(input: unknown): ManagedEntitySummary {
  return managedEntitySummarySchema.parse(input);
}

export function parseManagedEntityDetail(input: unknown): ManagedEntityDetail {
  return managedEntityDetailSchema.parse(input);
}

export function parseCreateSandboxServiceInput(input: unknown): CreateSandboxServiceInput {
  return createSandboxServiceInputSchema.parse(input);
}

export function parseDangerousAdoptManagedEntityInput(
  input: unknown,
): DangerousAdoptManagedEntityInput {
  return dangerousAdoptManagedEntityInputSchema.parse(input);
}

export function getSupportedAdvancedPropertySpec(key: SupportedAdvancedPropertyKey) {
  return supportedAdvancedPropertySpecs.find((spec) => spec.key === key);
}

export function getSupportedAdvancedPropertyGroupSpec(key: AdvancedPropertyGroup) {
  return supportedAdvancedPropertyGroupSpecs.find((spec) => spec.key === key);
}
