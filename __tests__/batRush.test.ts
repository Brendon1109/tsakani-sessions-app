import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  GOLD_MAX,
  GOLD_MIN,
  MAX_SPAWNS,
  POINTS,
  ROUND_MS,
  SCORE_CAP,
  SPAWNS,
  applyTap,
  auraBucket,
  planRound,
  rankFor,
  spawnTimes,
} from "@/lib/bat-rush/rules";
import { normaliseHandle } from "@/lib/bat-rush/handle";
import { chromeIntentUrl, inAppBrowser, isAndroid, isIOS } from "@/lib/bat-rush/in-app";
import {
  boardRound,
  followingRound,
  fromSastInput,
  openRound,
  roundStatus,
  sastClock,
  toSastInput,
  validateRoundEdit,
  type BatRushRound,
} from "@/lib/bat-rush/rounds";
import { decodeCarry, encodeCarry } from "@/lib/bat-rush/carry";
import { batRushBannerScript, isBatRushBannerOn } from "@/lib/bat-rush/banner";
import { csvCell, playersCsv } from "@/lib/bat-rush/csv";
import { adminBoard } from "@/lib/bat-rush/admin";

/** A seeded random, so a failing plan can be replayed. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("spawn schedule and score cap", () => {
  it("is the same every round, in order, inside the 30 seconds", () => {
    expect(spawnTimes()).toEqual(SPAWNS);
    expect(SPAWNS.length).toBe(MAX_SPAWNS);
    for (let i = 1; i < SPAWNS.length; i++) expect(SPAWNS[i]).toBeGreaterThan(SPAWNS[i - 1]);
    expect(SPAWNS[0]).toBeGreaterThanOrEqual(0);
    expect(SPAWNS[SPAWNS.length - 1]).toBeLessThan(ROUND_MS);
  });

  it("speeds up as the clock runs down", () => {
    const firstGap = SPAWNS[1] - SPAWNS[0];
    const lastGap = SPAWNS[SPAWNS.length - 1] - SPAWNS[SPAWNS.length - 2];
    expect(lastGap).toBeLessThan(firstGap / 2);
  });

  it("derives the cap from the schedule: every spawn caught, the most golds, no pumpkin", () => {
    expect(MAX_SPAWNS).toBe(72);
    expect(SCORE_CAP).toBe((MAX_SPAWNS - GOLD_MAX) * POINTS.bat + GOLD_MAX * POINTS.gold);
    expect(SCORE_CAP).toBe(270);
  });

  it("no real round can beat the cap", () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const plan = planRound(seeded(seed));
      expect(plan.length).toBe(MAX_SPAWNS);
      const golds = plan.filter((k) => k === "gold").length;
      expect(golds).toBeGreaterThanOrEqual(GOLD_MIN);
      expect(golds).toBeLessThanOrEqual(GOLD_MAX);
      // A perfect player catches every bat and gold and no pumpkin.
      const perfect = plan.reduce((sum, k) => sum + Math.max(0, POINTS[k]), 0);
      expect(perfect).toBeLessThanOrEqual(SCORE_CAP);
    }
  });

  it("the database refuses above the same cap", () => {
    const sql = readFileSync(path.join(__dirname, "..", "supabase", "bat_rush.sql"), "utf8");
    const check = sql.match(/aura integer not null check \(aura between 0 and (\d+)\)/);
    const fn = sql.match(/p_aura > (\d+)/);
    const note = sql.match(/THE SCORE CAP, (\d+),/);
    expect(check && Number(check[1])).toBe(SCORE_CAP);
    expect(fn && Number(fn[1])).toBe(SCORE_CAP);
    expect(note && Number(note[1])).toBe(SCORE_CAP);
  });
});

describe("scoring", () => {
  it("adds 1 for a bat and 67 for a gold bat", () => {
    expect(applyTap(0, "bat")).toBe(1);
    expect(applyTap(5, "gold")).toBe(72);
  });

  it("takes 10 for a pumpkin and never goes below zero", () => {
    expect(applyTap(25, "pumpkin")).toBe(15);
    expect(applyTap(4, "pumpkin")).toBe(0);
    expect(applyTap(0, "pumpkin")).toBe(0);
  });
});

describe("rank names", () => {
  it.each([
    [0, "Cooked"],
    [29, "Cooked"],
    [30, "It's giving"],
    [99, "It's giving"],
    [100, "Aura farmer"],
    [169, "Aura farmer"],
    [170, "Main character"],
    [270, "Main character"],
  ])("%i aura is %s", (aura, name) => {
    expect(rankFor(aura)).toBe(name);
  });

  it("buckets aura 20 wide for analytics", () => {
    expect(auraBucket(0)).toBe("0-19");
    expect(auraBucket(67)).toBe("60-79");
    expect(auraBucket(199)).toBe("180-199");
    expect(auraBucket(200)).toBe("200+");
  });
});

describe("Instagram handle", () => {
  it("takes a plain handle and strips one leading @", () => {
    expect(normaliseHandle("tsakani_sessions")).toEqual({ ok: true, handle: "tsakani_sessions" });
    expect(normaliseHandle("  @Lerato.M_99 ")).toEqual({ ok: true, handle: "Lerato.M_99" });
  });

  it("treats nothing as no handle", () => {
    expect(normaliseHandle("")).toEqual({ ok: true, handle: null });
    expect(normaliseHandle("   ")).toEqual({ ok: true, handle: null });
    expect(normaliseHandle("@")).toEqual({ ok: true, handle: null });
    expect(normaliseHandle(null)).toEqual({ ok: true, handle: null });
  });

  it("refuses anything Instagram would not allow", () => {
    for (const bad of ["two words", "emoji🎃", "dash-name", "@@double", "x".repeat(31), "<script>", "a/b"]) {
      expect(normaliseHandle(bad)).toEqual({ ok: false });
    }
    expect(normaliseHandle("x".repeat(30))).toEqual({ ok: true, handle: "x".repeat(30) });
  });
});

describe("in-app browser detection", () => {
  const UA = {
    instagramIos:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0.27.80 (iPhone15,3; iOS 18_6; en_ZA; en; scale=3.00; 1290x2796; 735229188)",
    instagramAndroid:
      "Mozilla/5.0 (Linux; Android 14; SM-A155F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.7390.122 Mobile Safari/537.36 Instagram 400.0.0.40.75 Android (34/14; 450dpi; 1080x2340; samsung; SM-A155F; a15; mt6789; en_ZA; 812345678)",
    facebookIos:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/520.0.0.38.101;FBBV/700000000;FBDV/iPhone14,7;FBMD/iPhone;FBSN/iOS;FBSV/18.5;FBSS/3;FBID/phone;FBLC/en_GB;FBOP/5]",
    facebookAndroid:
      "Mozilla/5.0 (Linux; Android 13; Infinix X6528 Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.7339.207 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/520.0.0.46.108;]",
    tiktok:
      "Mozilla/5.0 (Linux; Android 12; TECNO KI5q; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0.0.0 Mobile Safari/537.36 trill_410703 BytedanceWebview/d8a21c6 musical_ly_2024107030",
    chromeAndroid:
      "Mozilla/5.0 (Linux; Android 14; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
    safariIos:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
    desktop:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
  };

  it("finds Instagram, Facebook and TikTok on both phones", () => {
    expect(inAppBrowser(UA.instagramIos)).toBe("instagram");
    expect(inAppBrowser(UA.instagramAndroid)).toBe("instagram");
    expect(inAppBrowser(UA.facebookIos)).toBe("facebook");
    expect(inAppBrowser(UA.facebookAndroid)).toBe("facebook");
    expect(inAppBrowser(UA.tiktok)).toBe("tiktok");
  });

  it("leaves real browsers alone", () => {
    expect(inAppBrowser(UA.chromeAndroid)).toBeNull();
    expect(inAppBrowser(UA.safariIos)).toBeNull();
    expect(inAppBrowser(UA.desktop)).toBeNull();
    expect(inAppBrowser("")).toBeNull();
    expect(inAppBrowser(undefined)).toBeNull();
  });

  it("tells the two phones apart", () => {
    expect(isAndroid(UA.instagramAndroid)).toBe(true);
    expect(isIOS(UA.instagramAndroid)).toBe(false);
    expect(isIOS(UA.instagramIos)).toBe(true);
    expect(isAndroid(UA.instagramIos)).toBe(false);
  });

  it("builds a Chrome intent link that keeps the address", () => {
    const link = chromeIntentUrl("https://tsakanisessions.co.za/halloween?carry=abc");
    expect(link.startsWith("intent://tsakanisessions.co.za/halloween?carry=abc#Intent;")).toBe(true);
    expect(link).toContain("scheme=https;");
    expect(link).toContain("package=com.android.chrome;");
    expect(link).toContain(
      `S.browser_fallback_url=${encodeURIComponent("https://tsakanisessions.co.za/halloween?carry=abc")};`,
    );
    expect(link.endsWith(";end")).toBe(true);
  });
});

describe("rounds", () => {
  const t = (iso: string) => Date.parse(iso);
  const rounds: BatRushRound[] = [
    { id: "w", name: "Warm up", opens_at: "2026-10-29T00:00:00+02:00", closes_at: "2026-10-31T16:00:00+02:00", prize: null },
    { id: "1", name: "Round 1", opens_at: "2026-10-31T16:00:00+02:00", closes_at: "2026-10-31T19:30:00+02:00", prize: null },
    { id: "2", name: "Round 2", opens_at: "2026-10-31T19:30:00+02:00", closes_at: "2026-10-31T22:00:00+02:00", prize: null },
    { id: "3", name: "Round 3", opens_at: "2026-10-31T22:00:00+02:00", closes_at: "2026-11-01T00:30:00+02:00", prize: null },
  ];

  it("a score goes to the round open at that moment", () => {
    expect(openRound(rounds, t("2026-10-30T18:00:00+02:00"))?.name).toBe("Warm up");
    expect(openRound(rounds, t("2026-10-31T16:00:00+02:00"))?.name).toBe("Round 1");
    expect(openRound(rounds, t("2026-10-31T19:29:59+02:00"))?.name).toBe("Round 1");
    expect(openRound(rounds, t("2026-10-31T19:30:00+02:00"))?.name).toBe("Round 2");
    expect(openRound(rounds, t("2026-11-01T00:29:00+02:00"))?.name).toBe("Round 3");
  });

  it("no round is open before the first or after the last", () => {
    expect(openRound(rounds, t("2026-10-28T23:59:59+02:00"))).toBeNull();
    expect(openRound(rounds, t("2026-11-01T00:30:00+02:00"))).toBeNull();
  });

  it("when two overlap, the one closing first takes the score", () => {
    const overlap = [
      ...rounds,
      { id: "x", name: "Extra", opens_at: "2026-10-31T18:00:00+02:00", closes_at: "2026-10-31T23:00:00+02:00", prize: null },
    ];
    expect(openRound(overlap, t("2026-10-31T18:30:00+02:00"))?.name).toBe("Round 1");
  });

  it("the board shows the open round, else the last closed, else the next", () => {
    expect(boardRound(rounds, t("2026-10-31T20:00:00+02:00"))?.name).toBe("Round 2");
    expect(boardRound(rounds, t("2026-11-01T03:00:00+02:00"))?.name).toBe("Round 3");
    expect(boardRound(rounds, t("2026-10-20T12:00:00+02:00"))?.name).toBe("Warm up");
    expect(boardRound([], t("2026-10-31T20:00:00+02:00"))).toBeNull();
  });

  it("knows each round's status", () => {
    const now = t("2026-10-31T20:00:00+02:00");
    expect(rounds.map((r) => roundStatus(r, now))).toEqual(["closed", "closed", "open", "upcoming"]);
  });

  it("finds the round after a round, for Close now", () => {
    expect(followingRound(rounds, rounds[1])?.name).toBe("Round 2");
    expect(followingRound(rounds, rounds[3])).toBeNull();
  });

  it("reads and writes times in Cape Town time whatever the phone's zone", () => {
    expect(toSastInput("2026-10-31T17:30:00.000Z")).toBe("2026-10-31T19:30");
    expect(toSastInput("2026-10-31T22:30:00.000Z")).toBe("2026-11-01T00:30");
    expect(fromSastInput("2026-10-31T19:30")).toBe("2026-10-31T17:30:00.000Z");
    expect(fromSastInput(toSastInput("2026-10-31T14:00:00.000Z"))).toBe("2026-10-31T14:00:00.000Z");
    expect(fromSastInput("")).toBeNull();
    expect(fromSastInput("not a time")).toBeNull();
    expect(sastClock("2026-10-31T17:30:00.000Z")).toBe("19:30");
  });

  it("checks an admin edit", () => {
    expect(validateRoundEdit(null)).toEqual({ ok: false, error: "Nothing to save" });
    expect(validateRoundEdit({ opens_at: "x", closes_at: "y" })).toMatchObject({ ok: false });
    expect(
      validateRoundEdit({ opens_at: "2026-10-31T19:30:00Z", closes_at: "2026-10-31T19:30:00Z" }),
    ).toEqual({ ok: false, error: "Close has to be after open" });
    expect(
      validateRoundEdit({ opens_at: "2026-10-31T17:30:00Z", closes_at: "2026-10-31T20:00:00Z", prize: "x".repeat(121) }),
    ).toMatchObject({ ok: false });
    expect(
      validateRoundEdit({ opens_at: "2026-10-31T17:30:00Z", closes_at: "2026-10-31T20:00:00Z", prize: "  Free entry  " }),
    ).toEqual({
      ok: true,
      value: { opens_at: "2026-10-31T17:30:00.000Z", closes_at: "2026-10-31T20:00:00.000Z", prize: "Free entry" },
    });
    expect(
      validateRoundEdit({ opens_at: "2026-10-31T17:30:00Z", closes_at: "2026-10-31T20:00:00Z", prize: "   " }),
    ).toMatchObject({ ok: true, value: { prize: null } });
  });
});

describe("carrying a score out of Instagram", () => {
  it("comes back as the same score", () => {
    for (let aura = 0; aura <= SCORE_CAP; aura++) expect(decodeCarry(encodeCarry(aura))).toBe(aura);
  });

  it("refuses a hand edited or junk value", () => {
    const token = encodeCarry(40);
    const flipped = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    expect(decodeCarry(flipped)).toBeNull();
    expect(decodeCarry("270")).toBeNull();
    expect(decodeCarry("")).toBeNull();
    expect(decodeCarry(null)).toBeNull();
    expect(decodeCarry("ZZ!!")).toBeNull();
  });

  it("never carries more than the cap", () => {
    expect(decodeCarry(encodeCarry(9999))).toBe(SCORE_CAP);
  });
});

describe("home page banner window", () => {
  const at = (iso: string) => Date.parse(iso);

  it("is off on Friday while the game is tested by link", () => {
    expect(isBatRushBannerOn(at("2026-10-30T20:00:00+02:00"))).toBe(false);
    expect(isBatRushBannerOn(at("2026-10-31T11:59:59+02:00"))).toBe(false);
  });

  it("is on from midday on the 31st until 06:00 on the 1st", () => {
    expect(isBatRushBannerOn(at("2026-10-31T12:00:00+02:00"))).toBe(true);
    expect(isBatRushBannerOn(at("2026-11-01T05:59:59+02:00"))).toBe(true);
    expect(isBatRushBannerOn(at("2026-11-01T06:00:00+02:00"))).toBe(false);
  });

  it("the head script sets the attribute only inside the window", () => {
    const realNow = Date.now;
    const run = (iso: string) => {
      const attrs: Record<string, string> = {};
      Date.now = () => at(iso);
      try {
        new Function("document", batRushBannerScript)({
          documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
        });
      } finally {
        Date.now = realNow;
      }
      return attrs["data-bat-rush"];
    };
    expect(run("2026-10-31T21:00:00+02:00")).toBe("on");
    expect(run("2026-10-30T21:00:00+02:00")).toBeUndefined();
    expect(run("2026-11-01T07:00:00+02:00")).toBeUndefined();
  });
});

describe("admin CSV and board", () => {
  it("keeps a typed name from running as a formula", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"');
    expect(csvCell(null)).toBe("");
  });

  it("lists only players who gave a handle", () => {
    const csv = playersCsv([
      { handle: "lerato.m", show_handle: true, google_name: "Lerato M", email: "l@example.com", best_aura: 150, first_played: "2026-10-31T18:00:00Z" },
      { handle: null, show_handle: false, google_name: "No Handle", email: "n@example.com", best_aura: 20, first_played: "2026-10-31T18:05:00Z" },
    ]);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("lerato.m,https://instagram.com/lerato.m,yes");
    expect(csv).not.toContain("No Handle");
  });

  it("ranks best aura per player, first to get there wins a tie", () => {
    const players = [
      { user_id: "a", display_name: "Amo K.", instagram_handle: "amo", show_handle: true, created_at: "", profiles: null },
      { user_id: "b", display_name: "Bongi L.", instagram_handle: "bongi", show_handle: false, created_at: "", profiles: null },
      { user_id: "c", display_name: "Chris N.", instagram_handle: null, show_handle: false, created_at: "", profiles: null },
    ];
    const scores = [
      { id: 1, round_id: "r", user_id: "a", aura: 90, created_at: "2026-10-31T18:00:00Z" },
      { id: 2, round_id: "r", user_id: "a", aura: 140, created_at: "2026-10-31T18:10:00Z" },
      { id: 3, round_id: "r", user_id: "b", aura: 140, created_at: "2026-10-31T18:05:00Z" },
      { id: 4, round_id: "r", user_id: "c", aura: 30, created_at: "2026-10-31T18:01:00Z" },
      { id: 5, round_id: "other", user_id: "c", aura: 260, created_at: "2026-10-31T18:01:00Z" },
    ];
    const board = adminBoard({ players, scores }, "r");
    expect(board.map((r) => [r.rank, r.shown, r.aura, r.saves])).toEqual([
      [1, "Bongi L.", 140, 1],
      [2, "@amo", 140, 2],
      [3, "Chris N.", 30, 1],
    ]);
    expect(board[1].score_id).toBe(2);
  });
});
