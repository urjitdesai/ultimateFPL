const ONBOARDING_KEY_PREFIX = "ultimate-fpl:onboarding:2026.2:";

function keyFor(uid: string) {
  return `${ONBOARDING_KEY_PREFIX}${uid}`;
}

export function markOnboardingPending(uid: string, storage: Storage = window.localStorage) {
  storage.setItem(keyFor(uid), "pending");
}

export function completeOnboarding(uid: string, storage: Storage = window.localStorage) {
  storage.setItem(keyFor(uid), "complete");
}

export function hasPendingOnboarding(uid: string, storage: Storage = window.localStorage) {
  return storage.getItem(keyFor(uid)) === "pending";
}
