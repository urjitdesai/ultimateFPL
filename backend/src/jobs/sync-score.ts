import "../config/load-env.js";

const enabled = process.env.SCORING_JOB_ENABLED?.trim().toLowerCase() === "true";

if (!enabled) {
  console.log(JSON.stringify({ job: "sync-score", status: "SKIPPED_DISABLED" }));
} else {
  try {
    const { runSyncAndScore } = await import("./sync-score.service.js");
    const result = await runSyncAndScore();
    console.log(JSON.stringify({ job: "sync-score", ...result }));
  } catch (error) {
    console.error(JSON.stringify({
      job: "sync-score",
      status: "FAILED",
      error: error instanceof Error ? error.message : "Unknown failure",
    }));
    process.exitCode = 1;
  }
}
