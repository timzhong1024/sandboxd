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
        advancedProperties: {
          ProtectSystem: {
            parsed: true,
          },
          ReadOnlyPaths: [
            {
              parsed: ["/usr", "/etc"],
            },
          ],
          SystemCallFilter: [
            {
              parsed: {
                mode: "allow",
                values: ["@system-service"],
              },
            },
            {
              raw: "@system-service ~@privileged",
            },
          ],
        },
        unknownSystemdDirectives: [
          {
            section: "Service",
            key: "IPAddressDeny",
            value: "any",
            source: "unit-file",
          },
        ],
        profileMapping: {
          profile: "strict",
          profileDefaults: {
            noNewPrivileges: true,
            privateTmp: true,
            protectSystem: "strict",
            protectHome: true,
          },
          effectiveSandboxing: {
            noNewPrivileges: true,
            privateTmp: true,
            protectSystem: "strict",
            protectHome: false,
          },
          driftItems: [
            {
              property: "ProtectHome",
              expected: true,
              actual: false,
              status: "overridden",
            },
          ],
        },
        validation: {
          errors: [],
          warnings: [
            {
              code: "unknown-systemd-directive",
              level: "warning",
              message: "Unsupported systemd directives were detected.",
              scope: "entity",
            },
          ],
          readonly: true,
          readonlyReasons: ["Contains unsupported systemd directives."],
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
  expect(screen.getAllByText("service").length).toBeGreaterThan(0);
  expect(screen.getByText("Managed entity inventory")).toBeInTheDocument();
  expect(screen.getByText("Total entities")).toBeInTheDocument();
  expect(screen.getAllByText("sandboxd.slice")).toHaveLength(1);
  expect(screen.getByText("Resource controls")).toBeInTheDocument();
  expect(screen.getByText("Validation")).toBeInTheDocument();
  expect(screen.getByText("Profile mapping")).toBeInTheDocument();
  expect(screen.getAllByText("Contains unsupported systemd directives.").length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /advanced mode/i })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
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

test("renders advanced mode with grouped inspect-only fields and collapsed raw directives", () => {
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
        resourceControls: {},
        sandboxing: {},
        advancedProperties: {
          ProtectSystem: {
            parsed: true,
          },
          NoNewPrivileges: {
            parsed: true,
          },
          RestrictAddressFamilies: [
            {
              parsed: {
                mode: "allow",
                values: ["AF_UNIX", "AF_INET"],
              },
            },
          ],
        },
        unknownSystemdDirectives: [
          {
            section: "Service",
            key: "IPAddressDeny",
            value: "any",
            source: "unit-file",
          },
        ],
        status: {
          activeState: "active",
          subState: "running",
          loadState: "loaded",
        },
      }}
      detailError={null}
      detailPending={false}
      error={null}
      entities={[]}
      selectEntity={async () => {}}
      selectedUnitName="lab-api.service"
      triggerEntityAction={async () => {}}
      updateError={null}
      updatePending={false}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /advanced mode/i }));

  expect(screen.getAllByText("read-only").length).toBeGreaterThan(0);
  expect(screen.getAllByText("ProtectSystem").length).toBeGreaterThan(0);
  expect(screen.getAllByText("yes").length).toBeGreaterThan(0);
  expect(screen.getByText("Filesystem").closest("details")).toHaveAttribute("open");
  expect(screen.getByText("Network").closest("details")).not.toHaveAttribute("open");
  expect(screen.getByText("Unsupported / raw directives").closest("details")).not.toHaveAttribute(
    "open",
  );
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
});
