import type {
  CreateSandboxServiceInput,
  ManagedEntityDetail,
  ManagedEntitySummary,
} from "@sandboxd/core";
import { useEffect, useState } from "react";

interface UseManagedEntitiesViewModelOptions {
  createSandboxService: (input: CreateSandboxServiceInput) => Promise<ManagedEntityDetail>;
  loadManagedEntities: () => Promise<ManagedEntitySummary[]>;
  loadManagedEntity: (unitName: string) => Promise<ManagedEntityDetail>;
  restartManagedEntity: (unitName: string) => Promise<ManagedEntityDetail>;
  startManagedEntity: (unitName: string) => Promise<ManagedEntityDetail>;
  stopManagedEntity: (unitName: string) => Promise<ManagedEntityDetail>;
}

interface ManagedEntitiesViewModel {
  createError: string | null;
  createManagedEntity: (input: CreateSandboxServiceInput) => Promise<boolean>;
  createPending: boolean;
  detail: ManagedEntityDetail | null;
  detailError: string | null;
  detailPending: boolean;
  entities: ManagedEntitySummary[];
  error: string | null;
  selectEntity: (unitName: string) => Promise<void>;
  selectedUnitName: string | null;
  triggerEntityAction: (action: "restart" | "start" | "stop") => Promise<void>;
  updateError: string | null;
  updatePending: boolean;
}

export function useManagedEntitiesViewModel({
  createSandboxService,
  loadManagedEntities,
  loadManagedEntity,
  restartManagedEntity,
  startManagedEntity,
  stopManagedEntity,
}: UseManagedEntitiesViewModelOptions): ManagedEntitiesViewModel {
  const [entities, setEntities] = useState<ManagedEntitySummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedUnitName, setSelectedUnitName] = useState<string | null>(null);
  const [detail, setDetail] = useState<ManagedEntityDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailPending, setDetailPending] = useState(false);
  const [updatePending, setUpdatePending] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    void refreshEntities();
  }, [loadManagedEntities]);

  async function refreshEntities(preferredSelection?: string | null) {
    try {
      const loadedEntities = await loadManagedEntities();
      setEntities(loadedEntities);
      setError(null);

      const nextSelection =
        preferredSelection ?? selectedUnitName ?? loadedEntities[0]?.unitName ?? null;
      if (nextSelection) {
        await loadDetail(nextSelection);
      } else {
        setSelectedUnitName(null);
        setDetail(null);
      }
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Unknown error");
    }
  }

  async function loadDetail(unitName: string) {
    setSelectedUnitName(unitName);
    setDetailPending(true);
    setDetailError(null);

    try {
      const loadedDetail = await loadManagedEntity(unitName);
      setDetail(loadedDetail);
    } catch (loadError: unknown) {
      setDetailError(loadError instanceof Error ? loadError.message : "Unknown error");
      setDetail(null);
    } finally {
      setDetailPending(false);
    }
  }

  async function triggerEntityAction(action: "restart" | "start" | "stop") {
    if (!selectedUnitName) {
      return;
    }

    setUpdatePending(true);
    setUpdateError(null);

    try {
      const handlers = {
        restart: restartManagedEntity,
        start: startManagedEntity,
        stop: stopManagedEntity,
      } as const;
      const updatedDetail = await handlers[action](selectedUnitName);
      setDetail(updatedDetail);
      await refreshEntities(updatedDetail.unitName);
    } catch (actionError: unknown) {
      setUpdateError(actionError instanceof Error ? actionError.message : "Unknown error");
    } finally {
      setUpdatePending(false);
    }
  }

  async function createManagedEntity(input: CreateSandboxServiceInput) {
    setCreatePending(true);
    setCreateError(null);

    try {
      const createdEntity = await createSandboxService(input);
      setDetail(createdEntity);
      await refreshEntities(createdEntity.unitName);
      return true;
    } catch (creationError: unknown) {
      setCreateError(creationError instanceof Error ? creationError.message : "Unknown error");
      return false;
    } finally {
      setCreatePending(false);
    }
  }

  return {
    entities,
    error,
    selectedUnitName,
    detail,
    detailPending,
    detailError,
    updatePending,
    updateError,
    createPending,
    createError,
    selectEntity: loadDetail,
    triggerEntityAction,
    createManagedEntity,
  };
}
