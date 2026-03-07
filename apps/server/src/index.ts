import { createFixtureMetadataSource, parseFixtureName } from "./adapters/metadata/fixture-source";
import { createSystemctlRuntime } from "./adapters/systemd/systemctl-runtime";
import { createApp } from "./transport/http/create-app";
import { createListManagedEntities } from "./use-cases/list-managed-entities";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const fixtureName = parseFixtureName(process.env.SANDBOXD_ENTITY_FIXTURE);

const metadataSource = createFixtureMetadataSource(
  fixtureName === undefined ? {} : { defaultFixtureName: fixtureName },
);
const systemdRuntime = createSystemctlRuntime();
const listManagedEntities = createListManagedEntities({
  metadataSource,
  systemdRuntime,
});
const app = createApp({ listManagedEntities: () => listManagedEntities() });

app.listen(port, host, () => {
  console.log(`Sandboxd server listening on http://${host}:${port}`);
});
