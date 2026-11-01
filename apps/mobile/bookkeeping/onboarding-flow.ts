export const onboardingSteps = ['welcome', 'business', 'members', 'account', 'review', 'complete'] as const;
export type OnboardingStep = typeof onboardingSteps[number];

export function getNextOnboardingStep(
  step: OnboardingStep,
  options: { skipAccount?: boolean } = {},
): OnboardingStep {
  if (step === 'complete') return 'complete';
  if (step === 'account' && options.skipAccount) return 'review';
  const index = onboardingSteps.indexOf(step);
  return onboardingSteps[Math.min(index + 1, onboardingSteps.length - 1)];
}

export function getPreviousOnboardingStep(step: OnboardingStep): OnboardingStep {
  const index = onboardingSteps.indexOf(step);
  return onboardingSteps[Math.max(0, index - 1)];
}
