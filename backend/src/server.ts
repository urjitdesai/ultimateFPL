import { app } from "./app.js";
import { env } from "./config/env.js";
import { ensureDefaultLeagues } from "./leagues/leagues.service.js";

async function start() {
  await ensureDefaultLeagues();
  app.listen(env.PORT, () => console.log(`Ultimate FPL API listening on http://localhost:${env.PORT}`));
}

start().catch((error) => {
  console.error("Ultimate FPL API failed to start.", error);
  process.exitCode = 1;
});
