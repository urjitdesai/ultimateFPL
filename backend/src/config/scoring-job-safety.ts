export function scoringJobProjectIsValid(
  enabled: boolean,
  configuredProjectId: string,
  expectedProjectId: string | undefined,
) {
  return !enabled || (expectedProjectId != null && expectedProjectId === configuredProjectId);
}
