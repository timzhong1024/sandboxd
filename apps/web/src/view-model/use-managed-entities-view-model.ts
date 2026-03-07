import type { ManagedEntitySummary } from "@sandboxd/core";
import { useEffect, useState } from "react";

interface UseManagedEntitiesViewModelOptions {
  loadManagedEntities: () => Promise<ManagedEntitySummary[]>;
}

interface ManagedEntitiesViewModel {
  entities: ManagedEntitySummary[];
  error: string | null;
}

export function useManagedEntitiesViewModel({
  loadManagedEntities,
}: UseManagedEntitiesViewModelOptions): ManagedEntitiesViewModel {
  const [entities, setEntities] = useState<ManagedEntitySummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadManagedEntities()
      .then(setEntities)
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Unknown error");
      });
  }, [loadManagedEntities]);

  return {
    entities,
    error,
  };
}
