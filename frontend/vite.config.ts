import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const fileName = ["prod", "production"].includes(mode)
    ? "prod.env"
    : ["dev", "development"].includes(mode)
      ? "dev.env"
      : "local.env";
  const filePath = fileURLToPath(new URL(`../backend/env/${fileName}`, import.meta.url));
  const fileEnvironment = existsSync(filePath) ? parse(readFileSync(filePath)) : {};
  const value = (name: string) => process.env[name] ?? fileEnvironment[name] ?? "";

  return {
    plugins: [react()],
    server: { port: 5173 },
    define: {
      "import.meta.env.VITE_FIREBASE_API_KEY": JSON.stringify(value("FIREBASE_API_KEY")),
      "import.meta.env.VITE_FIREBASE_AUTH_DOMAIN": JSON.stringify(value("FIREBASE_AUTH_DOMAIN")),
      "import.meta.env.VITE_FIREBASE_PROJECT_ID": JSON.stringify(value("FIREBASE_PROJECT_ID")),
      "import.meta.env.VITE_FIREBASE_STORAGE_BUCKET": JSON.stringify(value("FIREBASE_STORAGE_BUCKET")),
      "import.meta.env.VITE_FIREBASE_APP_ID": JSON.stringify(value("FIREBASE_APP_ID")),
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(value("FRONTEND_API_BASE_URL"))
    }
  };
});
