import { expect, test } from "vitest";
import {
  getUnitFilePath,
  parseSystemctlListUnitsOutput,
  parseSystemctlShowOutput,
  renderSandboxServiceUnitFile,
  shouldUseFixture,
} from "./systemctl-runtime";

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

test("enables fixtures when explicitly requested through the environment", () => {
  expect(shouldUseFixture({ SANDBOXD_USE_FIXTURE: "1" })).toBe(true);
  expect(shouldUseFixture({ SANDBOXD_USE_FIXTURE: "0" })).toBe(false);
});

test("parses systemctl show output into a detail record", () => {
  const output = [
    "Id=lab-api.service",
    "Description=Sandboxd managed lab API",
    "LoadState=loaded",
    "ActiveState=active",
    "SubState=running",
    "Slice=sandboxd.slice",
    "CPUWeight=200",
    "MemoryMax=536870912",
    "TasksMax=512",
    "NoNewPrivileges=yes",
    "PrivateTmp=yes",
    "ProtectSystem=strict",
    "ProtectHome=no",
  ].join("\n");

  expect(parseSystemctlShowOutput(output)).toEqual({
    unitName: "lab-api.service",
    description: "Sandboxd managed lab API",
    loadState: "loaded",
    activeState: "active",
    subState: "running",
    slice: "sandboxd.slice",
    fragmentPath: undefined,
    unitFileState: undefined,
    resourceControls: {
      cpuWeight: "200",
      memoryMax: "536870912",
      tasksMax: "512",
    },
    sandboxing: {
      noNewPrivileges: true,
      privateTmp: true,
      protectSystem: "strict",
      protectHome: false,
    },
  });
});

test("renders a managed sandbox service unit file", () => {
  expect(
    renderSandboxServiceUnitFile("lab-api.service", {
      name: "lab-api",
      execStart: "/usr/bin/node server.js",
      sandboxProfile: "strict",
      workingDirectory: "/srv/lab",
      resourceControls: {
        cpuWeight: "200",
      },
    }),
  ).toContain("NoNewPrivileges=yes");
  expect(
    renderSandboxServiceUnitFile("lab-api.service", {
      name: "lab-api",
      execStart: "/usr/bin/node server.js",
      sandboxProfile: "strict",
      workingDirectory: "/srv/lab",
      resourceControls: {
        cpuWeight: "200",
      },
    }),
  ).toContain("WorkingDirectory=/srv/lab");
});

test("uses the configured unit directory path", () => {
  expect(getUnitFilePath("lab-api.service", { SANDBOXD_SYSTEMD_UNIT_DIR: "/tmp/systemd" })).toBe(
    "/tmp/systemd/lab-api.service",
  );
});
