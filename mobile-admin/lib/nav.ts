/**
 * Shared navigation helpers for the plant-admin app.
 *
 * The single helper here — `safeBack` — solves a real bug we hit while
 * QA-ing the app on the simulator: deep-linking straight into a stack
 * screen (e.g. `/audit-log`, `/reports`) leaves the navigator with an
 * empty history. Tapping the screen's back arrow then dispatches a
 * `GO_BACK` action that nothing in the tree can handle, and Expo Router
 * surfaces a noisy red banner: *"The action 'GO_BACK' was not handled
 * by any navigator."*
 *
 * Replace every bare `router.back()` with `safeBack(router)`. When the
 * stack actually has history we behave identically; otherwise we land
 * the user on the home tab — which is always a valid destination and
 * matches the user's intent of "get me out of this screen."
 */
import type { Router } from 'expo-router';

export function safeBack(router: Router, fallback: string = '/(tabs)/home'): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    // `replace` (not `push`) so the empty-history screen doesn't sit
    // underneath home in the stack, which would let "back" return to it.
    router.replace(fallback as any);
  }
}
