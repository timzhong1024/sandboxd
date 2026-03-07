import { createCreateSandboxService } from "./use-cases/create-sandbox-service";
import {
  createRestartManagedEntity,
  createStartManagedEntity,
  createStopManagedEntity,
} from "./use-cases/manage-entity-actions";
import { createLoadManagedEntity } from "./use-cases/load-managed-entity";
import { createManagedEntitiesHttpClient } from "./transport/http/managed-entities-client";
import { ManagedEntitiesScreen } from "./ui/managed-entities-screen";
import { createLoadManagedEntities } from "./use-cases/load-managed-entities";
import { useManagedEntitiesViewModel } from "./view-model/use-managed-entities-view-model";

const managedEntitiesClient = createManagedEntitiesHttpClient();
const loadManagedEntities = createLoadManagedEntities({
  client: managedEntitiesClient,
});
const loadManagedEntity = createLoadManagedEntity({
  client: managedEntitiesClient,
});
const startManagedEntity = createStartManagedEntity({
  client: managedEntitiesClient,
});
const stopManagedEntity = createStopManagedEntity({
  client: managedEntitiesClient,
});
const restartManagedEntity = createRestartManagedEntity({
  client: managedEntitiesClient,
});
const createSandboxService = createCreateSandboxService({
  client: managedEntitiesClient,
});

export function App() {
  const viewModel = useManagedEntitiesViewModel({
    loadManagedEntities,
    loadManagedEntity,
    startManagedEntity,
    stopManagedEntity,
    restartManagedEntity,
    createSandboxService,
  });

  return <ManagedEntitiesScreen {...viewModel} />;
}
