import assert from "node:assert/strict";
import test from "node:test";
import { getAllowedOrigins, validateEnvironment } from "../config.js";

test("validateEnvironment accepts complete, strong configuration", () => {
  process.env.FIREBASE_DATABASE_ID = "test-database";
  process.env.JWT_SECRET = "a-secure-test-secret-that-is-long-enough";

  assert.doesNotThrow(validateEnvironment);
});

test("validateEnvironment rejects a short JWT secret", () => {
  process.env.FIREBASE_DATABASE_ID = "test-database";
  process.env.JWT_SECRET = "too-short";

  assert.throws(validateEnvironment, /at least 32 characters/);
});

test("getAllowedOrigins parses configured origins", () => {
  process.env.CORS_ORIGINS = "https://app.example.com, https://admin.example.com";

  assert.deepEqual(getAllowedOrigins(), [
    "https://app.example.com",
    "https://admin.example.com",
  ]);
});
