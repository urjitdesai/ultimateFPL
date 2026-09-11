export function emailHasNotBeenAttempted(attempts: unknown) {
  return Number(attempts ?? 0) === 0;
}
