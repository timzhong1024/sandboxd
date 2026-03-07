import type { ManagedEntity } from "@sandboxd/core";
import { isSandboxdManaged } from "@sandboxd/core";
import { useEffect, useState } from "react";

async function loadEntities(): Promise<ManagedEntity[]> {
  const response = await fetch("/api/entities");
  if (!response.ok) {
    throw new Error(`Failed to load entities: ${response.status}`);
  }

  return response.json() as Promise<ManagedEntity[]>;
}

export function App() {
  const [entities, setEntities] = useState<ManagedEntity[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadEntities()
      .then(setEntities)
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Unknown error");
      });
  }, []);

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">Sandboxd</p>
        <h1>systemd-first homelab sandbox manager</h1>
        <p className="subtitle">当前骨架已经打通 WebUI、Node 控制面和共享实体模型。</p>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      <section className="panel">
        <div className="panel-header">
          <h2>Managed Entities</h2>
          <span>{entities.length} items</span>
        </div>
        <ul className="entity-list">
          {entities.map((entity) => (
            <li key={entity.unitName} className="entity-card">
              <div className="entity-row">
                <strong>{entity.unitName}</strong>
                <span className={`badge badge-${entity.kind}`}>{entity.kind}</span>
              </div>
              <div className="entity-row">
                <span>{entity.state}</span>
                <span className={isSandboxdManaged(entity) ? "managed" : "external"}>
                  {entity.origin}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
