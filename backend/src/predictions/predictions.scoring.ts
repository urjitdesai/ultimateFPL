export const SCORING_RULE_VERSION = "2026.3";

export type ScoringReason =
  | "EXACT_SCORE"
  | "CORRECT_GOAL_DIFFERENCE"
  | "CORRECT_RESULT"
  | "INCORRECT";

type ScoreInput = {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  isCaptain?: boolean;
};

function outcome(home: number, away: number) {
  return Math.sign(home - away);
}

export function scorePrediction(input: ScoreInput): {
  basePoints: number;
  points: number;
  reason: ScoringReason;
  ruleVersion: string;
} {
  const result = (basePoints: number, reason: ScoringReason) => ({
    basePoints,
    points: input.isCaptain ? basePoints * 2 : basePoints,
    reason,
    ruleVersion: SCORING_RULE_VERSION,
  });

  if (input.predictedHome === input.actualHome && input.predictedAway === input.actualAway) {
    return result(10, "EXACT_SCORE");
  }

  const correctResult = outcome(input.predictedHome, input.predictedAway)
    === outcome(input.actualHome, input.actualAway);
  if (correctResult && input.predictedHome - input.predictedAway === input.actualHome - input.actualAway) {
    return result(6, "CORRECT_GOAL_DIFFERENCE");
  }
  if (correctResult) {
    return result(3, "CORRECT_RESULT");
  }
  return result(0, "INCORRECT");
}
