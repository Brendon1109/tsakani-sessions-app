/**
 * The admin CSV of Bat Rush players who gave an Instagram handle, for tagging
 * winners and following up. The handle is all that purpose needs, so the
 * Google name and email stay on the admin screen and out of a file that can
 * outlive the 30 day delete.
 */
export interface CsvPlayer {
  handle: string | null;
  show_handle: boolean;
  best_aura: number | null;
  first_played: string | null;
}

/**
 * A cell a spreadsheet will not run. Quotes are doubled, and a value that
 * starts with = + - @ or a tab is prefixed with ' so Excel reads it as text
 * rather than a formula.
 */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function playersCsv(players: CsvPlayer[]): string {
  const header = ["instagram", "instagram_url", "shown_on_board", "best_aura", "first_played"];
  const rows = players
    .filter((p) => p.handle)
    .map((p) =>
      [
        p.handle,
        `https://instagram.com/${p.handle}`,
        p.show_handle ? "yes" : "no",
        p.best_aura,
        p.first_played,
      ]
        .map(csvCell)
        .join(","),
    );
  return [header.join(","), ...rows].join("\r\n") + "\r\n";
}
