import { buildApp } from "./app";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const app = buildApp();

app.listen(port, host, () => {
  console.log(`Sandboxd server listening on http://${host}:${port}`);
});
