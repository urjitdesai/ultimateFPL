export type PurgeSafetyInput = {
  allowedProjectIds: Set<string>;
  confirmationToken: string;
  configuredProjectId: string;
  confirmedProjectId: string;
  nodeEnvironment: string;
  protectedProjectIds: Set<string>;
};

export function validatePurgeTarget(input: PurgeSafetyInput) {
  if (input.nodeEnvironment === "production") {
    throw new Error("The purge script cannot run when NODE_ENV=production.");
  }
  if (!input.configuredProjectId) {
    throw new Error("FIREBASE_PROJECT_ID must identify the development project to purge.");
  }
  if (input.protectedProjectIds.has(input.configuredProjectId)) {
    throw new Error(`Project ${input.configuredProjectId} is protected and cannot be purged.`);
  }
  if (!input.allowedProjectIds.has(input.configuredProjectId)) {
    throw new Error(`Project ${input.configuredProjectId} is not in PURGE_ALLOWED_PROJECT_IDS.`);
  }
  if (input.confirmedProjectId !== input.configuredProjectId) {
    throw new Error(`Confirm the exact target with: npm run purge -- --project=${input.configuredProjectId}`);
  }
  const expectedConfirmationToken = `PURGE-${input.configuredProjectId}`;
  if (input.confirmationToken !== expectedConfirmationToken) {
    throw new Error(
      `Explicit confirmation is required: npm run purge -- --project=${input.configuredProjectId} --confirm=${expectedConfirmationToken}`,
    );
  }
  return input.configuredProjectId;
}
