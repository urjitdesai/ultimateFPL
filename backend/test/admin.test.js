import assert from "node:assert/strict";
import test from "node:test";
import { requireAdmin } from "../middleware/admin.js";

const createResponse = () => ({
  statusCode: null,
  body: null,
  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("requireAdmin rejects users outside the configured allowlist", () => {
  process.env.ADMIN_USER_IDS = "admin-1,admin-2";
  const response = createResponse();
  let calledNext = false;

  requireAdmin({ user: { id: "member-1" } }, response, () => {
    calledNext = true;
  });

  assert.equal(response.statusCode, 403);
  assert.equal(calledNext, false);
});

test("requireAdmin accepts a configured administrator", () => {
  process.env.ADMIN_USER_IDS = "admin-1, admin-2";
  const response = createResponse();
  let calledNext = false;

  requireAdmin({ user: { id: "admin-2" } }, response, () => {
    calledNext = true;
  });

  assert.equal(response.statusCode, null);
  assert.equal(calledNext, true);
});
