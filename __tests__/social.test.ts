import { describe, it, expect } from "vitest";
import { detectPlatform } from "@/lib/social";

describe("social platform detection", () => {
  it("detects TikTok URLs", () => {
    expect(
      detectPlatform("https://www.tiktok.com/@tsakani_sessions/video/123")
    ).toBe("tiktok");
    expect(detectPlatform("https://tiktok.com/@someone")).toBe("tiktok");
  });

  it("detects Instagram URLs", () => {
    expect(detectPlatform("https://www.instagram.com/p/ABC/")).toBe("instagram");
    expect(detectPlatform("https://instagram.com/tsakani_sessions")).toBe(
      "instagram"
    );
  });

  it("detects YouTube URLs (both forms)", () => {
    expect(detectPlatform("https://youtube.com/watch?v=abc")).toBe("youtube");
    expect(detectPlatform("https://youtu.be/abc")).toBe("youtube");
  });

  it("returns null for unknown URLs", () => {
    expect(detectPlatform("https://example.com")).toBe(null);
  });
});
