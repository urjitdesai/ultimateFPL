import { app } from "./app.js";
import { env } from "./config/env.js";
import { ensureDefaultLeagues } from "./leagues/leagues.service.js";

async function start() {
  await ensureDefaultLeagues();
  const server = app.listen(env.PORT, () => console.log(`Ultimate FPL API listening on port ${env.PORT}`));
  server.requestTimeout = env.REQUEST_TIMEOUT_MS;
  server.headersTimeout = env.HEADERS_TIMEOUT_MS;
  server.setTimeout(env.SERVER_TIMEOUT_MS);
}

start().catch((error) => {
  console.error("Ultimate FPL API failed to start.", error);
  process.exitCode = 1;
});
