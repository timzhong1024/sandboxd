import type { ManagedEntity } from "@sandboxd/core";
import { isSandboxdManaged } from "@sandboxd/core";

interface ManagedEntitiesScreenProps {
  entities: ManagedEntity[];
  error: string | null;
}

export function ManagedEntitiesScreen({ entities, error }: ManagedEntitiesScreenProps) {
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
