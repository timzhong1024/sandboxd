import { createCombinedMetadataSource } from "./adapters/metadata/combined-source";
import { createFilesystemMetadataSource } from "./adapters/metadata/filesystem-source";
import { createFixtureMetadataSource, parseFixtureName } from "./adapters/metadata/fixture-source";
import { createSystemctlRuntime } from "./adapters/systemd/systemctl-runtime";
import { createCreateSandboxService } from "./use-cases/create-sandbox-service";
import { createInspectManagedEntity } from "./use-cases/inspect-managed-entity";
import { createListManagedEntities } from "./use-cases/list-managed-entities";
import { createRestartManagedEntity } from "./use-cases/restart-managed-entity";
import { createStartManagedEntity } from "./use-cases/start-managed-entity";
import { createStopManagedEntity } from "./use-cases/stop-managed-entity";

export {
  ManagedEntityConflictError,
  ManagedEntityNotFoundError,
} from "./use-cases/managed-entity-errors";
export type {
  ManagedEntityFixtureName,
  ManagedEntityMetadataRecord,
  ManagedEntityMetadataSourcePort,
} from "./ports/managed-entity-metadata-source-port";
export type { SystemdRuntimePort } from "./ports/systemd-runtime-port";

export interface ControlPlane {
  createSandboxService: ReturnType<typeof createCreateSandboxService>;
  inspectManagedEntity: ReturnType<typeof createInspectManagedEntity>;
  listManagedEntities: ReturnType<typeof createListManagedEntities>;
  restartManagedEntity: ReturnType<typeof createRestartManagedEntity>;
  startManagedEntity: ReturnType<typeof createStartManagedEntity>;
  stopManagedEntity: ReturnType<typeof createStopManagedEntity>;
}

export function createControlPlane(environment: NodeJS.ProcessEnv = process.env): ControlPlane {
  const fixtureName = parseFixtureName(environment.SANDBOXD_ENTITY_FIXTURE);
  const fallbackMetadataSource = createFixtureMetadataSource(
    fixtureName === undefined ? {} : { defaultFixtureName: fixtureName },
  );
  const managedEntityMetadataSource = createFilesystemMetadataSource();
  const metadataSource = createCombinedMetadataSource({
    fallbackSource: fallbackMetadataSource,
    managedEntitySource: managedEntityMetadataSource,
  });
  const systemdRuntime = createSystemctlRuntime();

  return {
    listManagedEntities: createListManagedEntities({
      metadataSource,
      systemdRuntime,
    }),
    inspectManagedEntity: createInspectManagedEntity({
      metadataSource,
      systemdRuntime,
    }),
    startManagedEntity: createStartManagedEntity({
      metadataSource,
      systemdRuntime,
    }),
    stopManagedEntity: createStopManagedEntity({
      metadataSource,
      systemdRuntime,
    }),
    restartManagedEntity: createRestartManagedEntity({
      metadataSource,
      systemdRuntime,
    }),
    createSandboxService: createCreateSandboxService({
      metadataSource,
      systemdRuntime,
    }),
  };
}
