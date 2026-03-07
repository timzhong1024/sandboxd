import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ManagedEntitiesScreen } from "./managed-entities-screen";

test("renders managed entities and badges", () => {
  render(
    <ManagedEntitiesScreen
      createError={null}
      createManagedEntity={async () => true}
      createPending={false}
      detail={{
        kind: "sandbox-service",
        origin: "sandboxd",
        unitName: "lab-api.service",
        unitType: "service",
        state: "active",
        subState: "running",
        loadState: "loaded",
        slice: "sandboxd.slice",
        labels: {},
        capabilities: {
          canInspect: true,
          canStart: false,
          canStop: true,
          canRestart: true,
        },
        resourceControls: {
          cpuWeight: "200",
        },
        sandboxing: {
          noNewPrivileges: true,
        },
        status: {
          activeState: "active",
          subState: "running",
          loadState: "loaded",
        },
      }}
      detailError={null}
      detailPending={false}
      error={null}
      entities={[
        {
          kind: "sandbox-service",
          origin: "sandboxd",
          unitName: "lab-api.service",
          unitType: "service",
          state: "active",
          slice: "sandboxd.slice",
          labels: {},
          capabilities: {
            canInspect: true,
            canStart: false,
            canStop: true,
            canRestart: true,
          },
        },
      ]}
      selectEntity={async () => {}}
      selectedUnitName="lab-api.service"
      triggerEntityAction={async () => {}}
      updateError={null}
      updatePending={false}
    />,
  );

  expect(screen.getAllByText("lab-api.service")).toHaveLength(2);
  expect(screen.getByText("sandbox-service")).toBeInTheDocument();
  expect(screen.getAllByText("sandboxd")).toHaveLength(2);
  expect(screen.getByText("Managed entity inventory")).toBeInTheDocument();
  expect(screen.getByText("Total entities")).toBeInTheDocument();
  expect(screen.getAllByText("sandboxd.slice")).toHaveLength(2);
  expect(screen.getByText("Resource controls")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Restart" })).toBeEnabled();
});

test("opens the create panel", () => {
  render(
    <ManagedEntitiesScreen
      createError={null}
      createManagedEntity={async () => true}
      createPending={false}
      detail={null}
      detailError={null}
      detailPending={false}
      error={null}
      entities={[]}
      selectEntity={async () => {}}
      selectedUnitName={null}
      triggerEntityAction={async () => {}}
      updateError={null}
      updatePending={false}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /create service/i }));

  expect(screen.getByText("New sandboxed service")).toBeInTheDocument();
});
