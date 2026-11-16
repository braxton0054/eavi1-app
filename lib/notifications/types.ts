/**
 * What actually travels over the wire to a browser.
 *
 * Deliberately small: a title, one sentence, and where to open. Nothing that should not
 * survive being shown on a lock screen belongs here — details live behind the link, in
 * the portal, behind the user's own session.
 */
export type PushPayload = {
  title: string;
  body: string;
  /** In-app path to open on click; null opens the portal home. */
  url?: string | null;
  /** The event kind — announcement, fee, result, chat — for grouping and preferences. */
  type?: string;
};
