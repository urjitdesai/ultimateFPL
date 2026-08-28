import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config } from "dotenv";

function selectedEnvironmentFile() {
  const selectedEnvironment = (process.env.APP_ENV ?? process.env.NODE_ENV ?? "development")
    .trim()
    .toLowerCase();
  return ["prod", "production"].includes(selectedEnvironment) ? "prod.env" : "dev.env";
}

const environmentFile = fileURLToPath(
  new URL(`../../env/${selectedEnvironmentFile()}`, import.meta.url),
);

// Cloud Run injects its configuration directly. Locally, load the selected
// file without overwriting variables explicitly supplied by the shell or host.
if (existsSync(environmentFile)) {
  config({ path: path.resolve(environmentFile), override: false, quiet: true });
}
