import { createControlPlane } from "@sandboxd/control-plane";
import { createMcpHandler } from "./transport/http/create-mcp-handler";
import { createApp } from "./transport/http/create-app";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const controlPlane = createControlPlane();
const app = createApp({
  handleMcpRequest: createMcpHandler(controlPlane),
  listManagedEntities: () => controlPlane.listManagedEntities(),
  inspectManagedEntity: controlPlane.inspectManagedEntity,
  startManagedEntity: controlPlane.startManagedEntity,
  stopManagedEntity: controlPlane.stopManagedEntity,
  restartManagedEntity: controlPlane.restartManagedEntity,
  dangerouslyAdoptManagedEntity: controlPlane.dangerouslyAdoptManagedEntity,
  createSandboxService: controlPlane.createSandboxService,
  updateSandboxService: controlPlane.updateSandboxService,
  deleteSandboxService: controlPlane.deleteSandboxService,
});

app.listen(port, host, () => {
  console.log(`Sandboxd server listening on http://${host}:${port}`);
});
