export const SCORING_RULE_VERSION = "2026.1";

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
};

function outcome(home: number, away: number) {
  return Math.sign(home - away);
}

export function scorePrediction(input: ScoreInput): {
  points: number;
  reason: ScoringReason;
  ruleVersion: string;
} {
  if (input.predictedHome === input.actualHome && input.predictedAway === input.actualAway) {
    return { points: 5, reason: "EXACT_SCORE", ruleVersion: SCORING_RULE_VERSION };
  }

  const correctResult = outcome(input.predictedHome, input.predictedAway)
    === outcome(input.actualHome, input.actualAway);
  if (correctResult && input.predictedHome - input.predictedAway === input.actualHome - input.actualAway) {
    return { points: 3, reason: "CORRECT_GOAL_DIFFERENCE", ruleVersion: SCORING_RULE_VERSION };
  }
  if (correctResult) {
    return { points: 2, reason: "CORRECT_RESULT", ruleVersion: SCORING_RULE_VERSION };
  }
  return { points: 0, reason: "INCORRECT", ruleVersion: SCORING_RULE_VERSION };
}
