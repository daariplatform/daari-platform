import { Stack } from 'expo-router';

/**
 * Onboarding wizard stack. The root layout (app/_layout.tsx) redirects
 * brand-new plants here on first launch; once `allComplete` or `skipped`
 * flips, the same effect pushes them on to /(tabs)/home.
 *
 * The shell at app/onboarding/index.tsx swaps the visible step in-place —
 * the per-step files (step1-plant ... step5-done) are registered here
 * so deep-linking + back-stack behaviour stays sane if a designer wants
 * to jump straight to e.g. /onboarding/step3-customer in dev.
 */
export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="step1-plant" />
      <Stack.Screen name="step2-pricing" />
      <Stack.Screen name="step3-customer" />
      <Stack.Screen name="step4-driver" />
      <Stack.Screen name="step5-done" />
    </Stack>
  );
}
