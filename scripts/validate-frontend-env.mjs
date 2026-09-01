import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const environments = {
  development: {
    file: "dev.env",
    projectId: "ultimatefpl-cffba",
    databaseId: "ultimatefpl",
    frontendOrigin: "https://ultimatefpl-cffba.web.app",
  },
  production: {
    file: "prod.env",
    projectId: "predictionspremierleague-93b85",
    databaseId: "(default)",
    frontendOrigin: "https://predictions-premierleague.web.app",
  },
};

const target = process.argv[2];
const expected = environments[target];
if (!expected) {
  console.error("Usage: node scripts/validate-frontend-env.mjs development|production");
  process.exit(2);
}

const environmentPath = path.resolve("backend", "env", expected.file);
if (!existsSync(environmentPath)) {
  console.error(`Missing ${environmentPath}. Copy it from ${environmentPath}.example first.`);
  process.exit(1);
}

const values = Object.fromEntries(readFileSync(environmentPath, "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#") && line.includes("="))
  .map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));

const errors = [];
const expectValue = (name, value) => {
  if (values[name] !== value) errors.push(`${name} must be ${value}.`);
};
expectValue("FIREBASE_PROJECT_ID", expected.projectId);
expectValue("FIREBASE_DATABASE_ID", expected.databaseId);
expectValue("FIREBASE_AUTH_DOMAIN", `${expected.projectId}.firebaseapp.com`);
expectValue("FIREBASE_STORAGE_BUCKET", `${expected.projectId}.firebasestorage.app`);
expectValue("FRONTEND_URL", expected.frontendOrigin);

for (const name of ["FIREBASE_API_KEY", "FIREBASE_APP_ID", "FRONTEND_API_BASE_URL"]) {
  if (!values[name] || /replace|your_|inject_from/i.test(values[name])) {
    errors.push(`${name} must contain the deployed ${target} value.`);
  }
}

try {
  const apiUrl = new URL(values.FRONTEND_API_BASE_URL ?? "");
  if (apiUrl.protocol !== "https:" || !apiUrl.pathname.endsWith("/api/v1")) {
    errors.push("FRONTEND_API_BASE_URL must be an HTTPS URL ending in /api/v1.");
  }
} catch {
  errors.push("FRONTEND_API_BASE_URL must be a valid URL.");
}

if (errors.length > 0) {
  console.error(`Cannot deploy the ${target} frontend:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log(`${target} frontend configuration is isolated and deployable.`);
