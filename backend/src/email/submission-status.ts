type PredictionSubmissionRecord = {
  userId: string;
  fixtureId: string;
  submitted: boolean;
};

export function usersWithCompleteGameweekSubmission(
  fixtureIds: string[],
  predictions: PredictionSubmissionRecord[],
) {
  const requiredFixtureIds = new Set(fixtureIds);
  if (requiredFixtureIds.size === 0) return new Set<string>();

  const submittedFixturesByUser = new Map<string, Set<string>>();
  for (const prediction of predictions) {
    if (!prediction.submitted || !requiredFixtureIds.has(prediction.fixtureId)) continue;
    const submittedFixtures = submittedFixturesByUser.get(prediction.userId) ?? new Set<string>();
    submittedFixtures.add(prediction.fixtureId);
    submittedFixturesByUser.set(prediction.userId, submittedFixtures);
  }

  return new Set([...submittedFixturesByUser.entries()]
    .filter(([, submittedFixtures]) => submittedFixtures.size === requiredFixtureIds.size)
    .map(([userId]) => userId));
}
