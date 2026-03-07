import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          kind: "sandbox-service",
          origin: "sandboxd",
          unitName: "lab-api.service",
          unitType: "service",
          state: "active",
          slice: "sandboxd.slice",
          labels: {
            stack: "lab",
          },
          sandboxProfile: "strict",
        },
      ],
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders entities returned by the server", async () => {
  render(<App />);

  expect(await screen.findByText("lab-api.service")).toBeInTheDocument();
  expect(screen.getByText("sandbox-service")).toBeInTheDocument();
  expect(screen.getByText("sandboxd")).toBeInTheDocument();
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
