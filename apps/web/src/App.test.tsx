import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url === "/api/entities") {
        return {
          ok: true,
          json: async () => [
            {
              kind: "sandbox-service",
              origin: "sandboxd",
              unitName: "lab-api.service",
              unitType: "service",
              state: "active",
              subState: "running",
              loadState: "loaded",
              slice: "sandboxd.slice",
              labels: {
                stack: "lab",
              },
              sandboxProfile: "strict",
              capabilities: {
                canInspect: true,
                canStart: false,
                canStop: true,
                canRestart: true,
              },
            },
          ],
        };
      }

      return {
        ok: true,
        json: async () => ({
          kind: "sandbox-service",
          origin: "sandboxd",
          unitName: "lab-api.service",
          unitType: "service",
          state: "active",
          subState: "running",
          loadState: "loaded",
          slice: "sandboxd.slice",
          labels: {
            stack: "lab",
          },
          sandboxProfile: "strict",
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
        }),
      };
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders entities returned by the server", async () => {
  render(<App />);

  expect(await screen.findAllByText("lab-api.service")).toHaveLength(2);
  expect(screen.getAllByText("service").length).toBeGreaterThan(0);
  expect(
    screen.getByText("A homelab control surface with the feel of a compact appliance."),
  ).toBeInTheDocument();
  expect(await screen.findByText("Resource controls")).toBeInTheDocument();
});

test("surfaces runtime payload validation errors", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ unitName: "broken.service", labels: {} }],
    }),
  );

  render(<App />);

  expect(await screen.findByRole("alert")).toHaveTextContent(/"kind"/i);
});
