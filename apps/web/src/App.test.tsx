import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { App } from "./App";

const sampleResponse = [
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
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleResponse,
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
