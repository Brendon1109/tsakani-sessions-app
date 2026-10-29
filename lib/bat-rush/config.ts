/**
 * Bat Rush settings that are not game rules. The competition belongs to the
 * events row with this slug, so the next Tsakani event can run its own rounds
 * by pointing this at its own slug and seeding rounds for it.
 */
export const BAT_RUSH_EVENT_SLUG = "hallowee-kani";

export const INSTAGRAM_HANDLE = "tsakani_sessions";
export const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM_HANDLE}`;

/** The guest's best round, kept on the phone until they sign in. */
export const GUEST_BEST_KEY = "bat-rush:best";

/** Where sign in comes back to. */
export const GAME_PATH = "/halloween";
