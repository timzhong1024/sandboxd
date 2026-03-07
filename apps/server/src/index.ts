import { buildApp } from "./app";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

const app = buildApp();

app.listen(port, () => {
  console.log(`Sandboxd server listening on http://localhost:${port}`);
});
