import type { Href } from 'expo-router';

/** What a "Back" control should do: pop to the previous screen, or replace with a fallback. */
export type BackAction = { type: 'back' } | { type: 'replace'; href: Href };

/**
 * Decide where a "Back" control goes.
 *
 * Normally that's the previous screen. But a screen can be the first one in
 * the stack (opened from a link, or after a reload), and then there is no
 * previous screen — `router.back()` would do nothing and the button would look
 * dead. In that case we go to `fallback` instead.
 */
export function backAction(canGoBack: boolean, fallback: Href): BackAction {
  return canGoBack ? { type: 'back' } : { type: 'replace', href: fallback };
}
