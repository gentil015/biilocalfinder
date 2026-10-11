import { ProviderOnboardingStep } from './api';

// Single source of truth for "where does this step live" — used both
// right after registration and by each onboarding page's own resume
// check, so they can never disagree about the URL for a given step.
export function onboardingStepPath(step: ProviderOnboardingStep): string {
  switch (step) {
    case 'TYPE_SELECTION':
      return '/provider/onboarding';
    case 'PROFILE_DETAILS':
      return '/provider/onboarding/profile';
    case 'SERVICES_SETUP':
    case 'VERIFICATION':
      return '/provider/onboarding/services';
    case 'COMPLETED':
      return '/provider/dashboard';
    default:
      return '/provider/onboarding';
  }
}
