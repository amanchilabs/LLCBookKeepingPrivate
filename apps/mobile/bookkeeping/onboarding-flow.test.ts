import { describe, expect, it } from 'vitest';
import { getNextOnboardingStep, getPreviousOnboardingStep, onboardingSteps } from './onboarding-flow';

describe('onboarding step flow', () => {
  it('moves through the approved setup sequence in order', () => {
    expect(onboardingSteps).toEqual(['welcome', 'business', 'members', 'account', 'review', 'complete']);
    expect(onboardingSteps.slice(0, -1).map((step) => getNextOnboardingStep(step))).toEqual(onboardingSteps.slice(1));
  });

  it('returns to the prior setup step without crossing the welcome boundary', () => {
    expect(getPreviousOnboardingStep('welcome')).toBe('welcome');
    expect(getPreviousOnboardingStep('review')).toBe('account');
  });

  it('allows account setup to be skipped directly to review', () => {
    expect(getNextOnboardingStep('account', { skipAccount: true })).toBe('review');
  });
});
