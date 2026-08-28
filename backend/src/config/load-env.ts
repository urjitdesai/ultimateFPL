import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config } from "dotenv";

function selectedEnvironmentFile() {
  const appEnvironment = process.env.APP_ENV?.trim().toLowerCase();
  if (["prod", "production"].includes(appEnvironment ?? "")) return "prod.env";
  if (["dev", "development"].includes(appEnvironment ?? "")) return "dev.env";
  if (appEnvironment === "local") return "local.env";

  // Cloud Run supplies NODE_ENV=production directly. Local commands do not
  // need an environment selector and therefore default to local.env.
  return process.env.NODE_ENV?.trim().toLowerCase() === "production"
    ? "prod.env"
    : "local.env";
}

const environmentFile = fileURLToPath(
  new URL(`../../env/${selectedEnvironmentFile()}`, import.meta.url),
);

// Cloud Run injects its configuration directly. Locally, load the selected
// file without overwriting variables explicitly supplied by the shell or host.
if (existsSync(environmentFile)) {
  config({ path: path.resolve(environmentFile), override: false, quiet: true });
}
