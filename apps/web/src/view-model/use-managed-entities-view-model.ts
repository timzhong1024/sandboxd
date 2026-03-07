import type { ManagedEntity } from "@sandboxd/core";
import { useEffect, useState } from "react";

interface UseManagedEntitiesViewModelOptions {
  loadManagedEntities: () => Promise<ManagedEntity[]>;
}

interface ManagedEntitiesViewModel {
  entities: ManagedEntity[];
  error: string | null;
}

export function useManagedEntitiesViewModel({
  loadManagedEntities,
}: UseManagedEntitiesViewModelOptions): ManagedEntitiesViewModel {
  const [entities, setEntities] = useState<ManagedEntity[]>([]);
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
