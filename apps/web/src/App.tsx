import { createManagedEntitiesHttpClient } from "./transport/http/managed-entities-client";
import { ManagedEntitiesScreen } from "./ui/managed-entities-screen";
import { createLoadManagedEntities } from "./use-cases/load-managed-entities";
import { useManagedEntitiesViewModel } from "./view-model/use-managed-entities-view-model";

const managedEntitiesClient = createManagedEntitiesHttpClient();
const loadManagedEntities = createLoadManagedEntities({
  client: managedEntitiesClient,
});

export function App() {
  const { entities, error } = useManagedEntitiesViewModel({
    loadManagedEntities,
  });

  return <ManagedEntitiesScreen entities={entities} error={error} />;
}
