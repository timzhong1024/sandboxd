import { expect, test } from "vitest";
import { parseSystemctlListUnitsOutput } from "./entities";

test("parses the standard systemctl list-units text format", () => {
  const output = [
    "docker.service loaded active running Docker Application Container Engine",
    "sandboxd.slice loaded active active Sandboxd Root Slice",
  ].join("\n");

  expect(parseSystemctlListUnitsOutput(output)).toEqual([
    {
      unitName: "docker.service",
      loadState: "loaded",
      activeState: "active",
      subState: "running",
      description: "Docker Application Container Engine",
    },
    {
      unitName: "sandboxd.slice",
      loadState: "loaded",
      activeState: "active",
      subState: "active",
      description: "Sandboxd Root Slice",
    },
  ]);
});
