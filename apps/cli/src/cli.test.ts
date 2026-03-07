import { describe, expect, test, vi } from "vitest";
import type { ControlPlane } from "@sandboxd/control-plane";
import { runCli } from "./cli";

function createControlPlaneMock(): ControlPlane {
  return {
    createSandboxService: vi.fn(),
    dangerouslyAdoptManagedEntity: vi.fn(),
    inspectManagedEntity: vi.fn(),
    listManagedEntities: vi.fn(),
    restartManagedEntity: vi.fn(),
    startManagedEntity: vi.fn(),
    stopManagedEntity: vi.fn(),
  };
}

describe("runCli", () => {
  test("renders a text table for list", async () => {
    const stdout = { write: vi.fn() };
    const controlPlane = createControlPlaneMock();
    vi.mocked(controlPlane.listManagedEntities).mockResolvedValue([
      {
        unitName: "lab-api.service",
        kind: "sandbox-service",
        origin: "sandboxd",
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
    ]);

    const exitCode = await runCli(["list"], {
      createControlPlane: () => controlPlane,
      stdout,
    });

    expect(exitCode).toBe(0);
    expect(controlPlane.listManagedEntities).toHaveBeenCalledOnce();
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining("UNIT"));
    expect(stdout.write).toHaveBeenCalledWith(expect.stringContaining("lab-api.service"));
  });

  test("renders json for inspect", async () => {
    const stdout = { write: vi.fn() };
    const controlPlane = createControlPlaneMock();
    vi.mocked(controlPlane.inspectManagedEntity).mockResolvedValue({
      unitName: "lab-api.service",
      kind: "sandbox-service",
      origin: "sandboxd",
      unitType: "service",
      state: "active",
      subState: "running",
      loadState: "loaded",
      labels: {},
      capabilities: {
        canInspect: true,
        canStart: false,
        canStop: true,
        canRestart: true,
      },
      resourceControls: {},
      sandboxing: {},
      status: {
        activeState: "active",
        subState: "running",
        loadState: "loaded",
      },
    });

    const exitCode = await runCli(["inspect", "lab-api.service", "--json"], {
      createControlPlane: () => controlPlane,
      stdout,
    });

    expect(exitCode).toBe(0);
    expect(controlPlane.inspectManagedEntity).toHaveBeenCalledWith("lab-api.service");
    expect(stdout.write).toHaveBeenCalledWith(
      expect.stringContaining('"unitName": "lab-api.service"'),
    );
  });

  test("parses create flags into the control-plane payload", async () => {
    const stdout = { write: vi.fn() };
    const controlPlane = createControlPlaneMock();
    vi.mocked(controlPlane.createSandboxService).mockResolvedValue({
      unitName: "lab-worker.service",
      kind: "sandbox-service",
      origin: "sandboxd",
      unitType: "service",
      state: "inactive",
      subState: "dead",
      loadState: "loaded",
      labels: {},
      capabilities: {
        canInspect: true,
        canStart: true,
        canStop: false,
        canRestart: false,
      },
      resourceControls: {},
      sandboxing: {},
      status: {
        activeState: "inactive",
        subState: "dead",
        loadState: "loaded",
      },
    });

    const exitCode = await runCli(
      [
        "create",
        "sandboxed-service",
        "lab-worker",
        "--exec-start",
        "/usr/bin/python worker.py",
        "--cpu-weight",
        "200",
        "--memory-max",
        "512M",
        "--no-new-privileges",
      ],
      {
        createControlPlane: () => controlPlane,
        stdout,
      },
    );

    expect(exitCode).toBe(0);
    expect(controlPlane.createSandboxService).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "lab-worker",
        execStart: "/usr/bin/python worker.py",
        resourceControls: expect.objectContaining({
          cpuWeight: "200",
          memoryMax: "512M",
        }),
        sandboxing: expect.objectContaining({
          noNewPrivileges: true,
        }),
      }),
    );
  });

  test("returns exit code 1 and preserves control-plane errors", async () => {
    const stderr = { write: vi.fn() };
    const controlPlane = createControlPlaneMock();
    vi.mocked(controlPlane.startManagedEntity).mockRejectedValue(
      new Error("Managed entity cannot be started"),
    );

    const exitCode = await runCli(["start", "docker.service"], {
      createControlPlane: () => controlPlane,
      stderr,
    });

    expect(exitCode).toBe(1);
    expect(stderr.write).toHaveBeenCalledWith(
      expect.stringContaining("Managed entity cannot be started"),
    );
  });

  test("parses dangerous-adopt flags into the control-plane payload", async () => {
    const stdout = { write: vi.fn() };
    const controlPlane = createControlPlaneMock();
    vi.mocked(controlPlane.dangerouslyAdoptManagedEntity).mockResolvedValue({
      unitName: "docker.service",
      kind: "sandbox-service",
      origin: "sandboxd",
      unitType: "service",
      state: "active",
      subState: "running",
      loadState: "loaded",
      labels: {},
      capabilities: {
        canInspect: true,
        canStart: false,
        canStop: true,
        canRestart: true,
      },
      resourceControls: {},
      sandboxing: {},
      status: {
        activeState: "active",
        subState: "running",
        loadState: "loaded",
      },
    });

    const exitCode = await runCli(["dangerous-adopt", "docker.service", "--profile", "baseline"], {
      createControlPlane: () => controlPlane,
      stdout,
    });

    expect(exitCode).toBe(0);
    expect(controlPlane.dangerouslyAdoptManagedEntity).toHaveBeenCalledWith("docker.service", {
      sandboxProfile: "baseline",
    });
  });

  test("returns exit code 2 for missing required create flags", async () => {
    const stderr = { write: vi.fn() };

    const exitCode = await runCli(["create", "sandboxed-service", "lab-worker"], { stderr });

    expect(exitCode).toBe(2);
    expect(stderr.write).toHaveBeenCalledWith(expect.stringContaining("requires --exec-start"));
  });
});
