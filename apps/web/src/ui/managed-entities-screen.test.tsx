import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { ManagedEntitiesScreen } from "./managed-entities-screen";

test("renders managed entities and badges", () => {
  render(
    <ManagedEntitiesScreen
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
    />,
  );

  expect(screen.getByText("lab-api.service")).toBeInTheDocument();
  expect(screen.getByText("sandbox-service")).toBeInTheDocument();
  expect(screen.getByText("sandboxd")).toBeInTheDocument();
  expect(screen.getByText("Managed entity inventory")).toBeInTheDocument();
  expect(screen.getByText("Total entities")).toBeInTheDocument();
  expect(screen.getByText("sandboxd.slice")).toBeInTheDocument();
});
