import { createCombinedMetadataSource } from "./adapters/metadata/combined-source";
import { createFilesystemMetadataSource } from "./adapters/metadata/filesystem-source";
import { createFixtureMetadataSource, parseFixtureName } from "./adapters/metadata/fixture-source";
import { createSystemctlRuntime } from "./adapters/systemd/systemctl-runtime";
import { createApp } from "./transport/http/create-app";
import { createCreateSandboxService } from "./use-cases/create-sandbox-service";
import { createInspectManagedEntity } from "./use-cases/inspect-managed-entity";
import { createListManagedEntities } from "./use-cases/list-managed-entities";
import { createRestartManagedEntity } from "./use-cases/restart-managed-entity";
import { createStartManagedEntity } from "./use-cases/start-managed-entity";
import { createStopManagedEntity } from "./use-cases/stop-managed-entity";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const fixtureName = parseFixtureName(process.env.SANDBOXD_ENTITY_FIXTURE);

const fallbackMetadataSource = createFixtureMetadataSource(
  fixtureName === undefined ? {} : { defaultFixtureName: fixtureName },
);
const managedEntityMetadataSource = createFilesystemMetadataSource();
const metadataSource = createCombinedMetadataSource({
  fallbackSource: fallbackMetadataSource,
  managedEntitySource: managedEntityMetadataSource,
});
const systemdRuntime = createSystemctlRuntime();
const listManagedEntities = createListManagedEntities({
  metadataSource,
  systemdRuntime,
});
const inspectManagedEntity = createInspectManagedEntity({
  metadataSource,
  systemdRuntime,
});
const startManagedEntity = createStartManagedEntity({
  metadataSource,
  systemdRuntime,
});
const stopManagedEntity = createStopManagedEntity({
  metadataSource,
  systemdRuntime,
});
const restartManagedEntity = createRestartManagedEntity({
  metadataSource,
  systemdRuntime,
});
const createSandboxService = createCreateSandboxService({
  metadataSource,
  systemdRuntime,
});
const app = createApp({
  listManagedEntities: () => listManagedEntities(),
  inspectManagedEntity,
  startManagedEntity,
  stopManagedEntity,
  restartManagedEntity,
  createSandboxService,
});

app.listen(port, host, () => {
  console.log(`Sandboxd server listening on http://${host}:${port}`);
});
