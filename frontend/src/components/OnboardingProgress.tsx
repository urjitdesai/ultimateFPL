export function OnboardingProgress({ step }: { step: 1 | 2 }) {
  return <div className={`onboarding-progress onboarding-progress-step-${step}`}>
    <div className="onboarding-progress-copy"><span>Step {step} of 2</span><strong>{step === 1 ? "Create account" : "Build profile"}</strong></div>
    <div className="onboarding-progress-track" role="progressbar" aria-label="Signup progress" aria-valuemin={1} aria-valuemax={2} aria-valuenow={step} aria-valuetext={`Step ${step} of 2`}><span /></div>
    <div className="onboarding-progress-labels" aria-hidden="true"><span className="is-complete">Account</span><span className={step === 2 ? "is-complete" : ""}>Profile</span></div>
  </div>;
}
