import { expect, test } from "vitest";
import { isSandboxdManaged, type ManagedEntity } from "./index";

test("identifies sandboxd-managed entities", () => {
  const entity: ManagedEntity = {
    kind: "sandbox-service",
    origin: "sandboxd",
    unitName: "lab-api.service",
    unitType: "service",
    state: "active",
    labels: {},
  };

  expect(isSandboxdManaged(entity)).toBe(true);
});
