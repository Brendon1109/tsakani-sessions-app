/**
 * One palette for every QR code this app draws.
 *
 * It lives in its own module with no imports because three very different
 * places need it — a client component that draws to a canvas, a server module
 * that renders a PNG for email, and a test that decodes both — and the whole
 * point is that they cannot disagree.
 *
 * WHY DARK-ON-LIGHT, given the site is dark:
 *
 * The ticket page used to draw gold (#ffd700) modules on near-black (#111111),
 * which looks right on the page and is an INVERTED QR code — light modules on a
 * dark field, the reverse of the spec. Phone cameras cope, because they try both
 * polarities. Plenty of software does not: the door scanner is handed frames and
 * asked to decode them, and decoding both polarities on every frame is a cost
 * most decoders default away from.
 *
 * The result was a ticket that a guest's own camera could read and the door
 * could not — the exact report from the field. Every guest showing the ticket
 * page (which says "Show this at the door") was unscannable, while the emailed
 * PNG, already dark-on-white for printing, worked fine.
 *
 * A QR code is not decoration. Its entire job is to be read by a machine that
 * we do not control, so it renders the way every decoder expects and the styling
 * goes around it — a white card on the dark page — rather than into it.
 *
 * The white field is not only about polarity. A bright patch gives a phone
 * camera something to expose and focus against; a mostly-black screen in a dark
 * venue gives it very little.
 */
export const QR_COLORS = {
  dark: "#000000",
  light: "#ffffff",
} as const;
