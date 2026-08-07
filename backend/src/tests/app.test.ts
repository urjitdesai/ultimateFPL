import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import { supporterLeagueIdentity } from "../users/users.service.js";

describe("foundation API", () => {
  it("reports health", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns the text-only team catalog", async () => {
    const response = await request(app).get("/api/v1/teams");
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(20);
    expect(response.body.data[0]).toMatchObject({ id: "arsenal", shortName: "ARS" });
  });

  it("protects profile registration", async () => {
    const response = await request(app).post("/api/v1/auth/register-profile").send({ displayName: "Alex", favoriteTeamId: "arsenal" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("uses deterministic supporter league and membership ids", () => {
    expect(supporterLeagueIdentity("2026-27", "arsenal", "user-1")).toEqual({
      leagueId: "2026-27_team_arsenal",
      membershipId: "2026-27_team_arsenal_user-1"
    });
  });
});
