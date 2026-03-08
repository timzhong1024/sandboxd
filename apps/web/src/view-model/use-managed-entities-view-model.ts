import type {
  CreateSandboxServiceInput,
  ManagedEntityDetail,
  ManagedEntitySummary,
} from "@sandboxd/core";
import { useEffect, useRef, useState } from "react";

const DETAIL_LOADING_DELAY_MS = 120;
const DETAIL_LOADING_MIN_VISIBLE_MS = 240;

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
  const detailRequestIdRef = useRef(0);
  const detailPendingRef = useRef(false);
  const detailLoadingDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void refreshEntities();
  }, [loadManagedEntities]);

  useEffect(() => {
    return () => {
      if (detailLoadingDelayRef.current) {
        clearTimeout(detailLoadingDelayRef.current);
      }
    };
  }, []);

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

  function setDetailPendingState(next: boolean) {
    detailPendingRef.current = next;
    setDetailPending(next);
  }

  async function loadDetail(unitName: string) {
    const requestId = ++detailRequestIdRef.current;
    let loadingShownAt = detailPendingRef.current ? Date.now() : null;
    let shouldClearPending = true;

    if (detailLoadingDelayRef.current) {
      clearTimeout(detailLoadingDelayRef.current);
      detailLoadingDelayRef.current = null;
    }

    setSelectedUnitName(unitName);
    setDetailError(null);

    if (!detailPendingRef.current) {
      detailLoadingDelayRef.current = setTimeout(() => {
        if (detailRequestIdRef.current !== requestId || detailPendingRef.current) {
          return;
        }
        loadingShownAt = Date.now();
        setDetailPendingState(true);
      }, DETAIL_LOADING_DELAY_MS);
    }

    try {
      const loadedDetail = await loadManagedEntity(unitName);
      if (detailRequestIdRef.current !== requestId) {
        shouldClearPending = false;
        return;
      }
      setDetail(loadedDetail);
    } catch (loadError: unknown) {
      if (detailRequestIdRef.current !== requestId) {
        shouldClearPending = false;
        return;
      }
      setDetailError(loadError instanceof Error ? loadError.message : "Unknown error");
      setDetail(null);
    } finally {
      if (detailLoadingDelayRef.current) {
        clearTimeout(detailLoadingDelayRef.current);
        detailLoadingDelayRef.current = null;
      }

      if (shouldClearPending && detailRequestIdRef.current === requestId) {
        if (loadingShownAt !== null) {
          const visibleFor = Date.now() - loadingShownAt;
          const remainingVisibleTime = DETAIL_LOADING_MIN_VISIBLE_MS - visibleFor;
          if (remainingVisibleTime > 0) {
            await new Promise((resolve) => {
              setTimeout(resolve, remainingVisibleTime);
            });
          }
        }

        if (detailRequestIdRef.current === requestId) {
          setDetailPendingState(false);
        }
      }
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
