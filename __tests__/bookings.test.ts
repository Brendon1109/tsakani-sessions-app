import { describe, it, expect } from "vitest";
import { validateBookingInput } from "@/lib/bookings";

describe("validateBookingInput", () => {
  it("accepts a booking with a name and an email", () => {
    const result = validateBookingInput({
      name: "  Thabo  ",
      email: "thabo@example.com",
      event_type: "DJ & Live Performance",
      venue: "The Spot",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("Thabo");
      expect(result.value.email).toBe("thabo@example.com");
      expect(result.value.phone).toBeNull();
      expect(result.value.event_type).toBe("DJ & Live Performance");
    }
  });

  it("accepts a booking with a name and a phone only", () => {
    const result = validateBookingInput({ name: "Sam", phone: "082 123 4567" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.phone).toBe("082 123 4567");
      expect(result.value.email).toBeNull();
    }
  });

  it("rejects a missing or blank name", () => {
    expect(validateBookingInput({ email: "a@b.com" }).ok).toBe(false);
    expect(validateBookingInput({ name: "   ", email: "a@b.com" }).ok).toBe(false);
  });

  it("rejects when neither email nor phone is given", () => {
    const result = validateBookingInput({ name: "Nobody" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/email or a phone/i);
  });

  it("rejects an obviously invalid email", () => {
    const result = validateBookingInput({ name: "Zip", email: "not-an-email" });
    expect(result.ok).toBe(false);
  });

  it("rejects non-object bodies", () => {
    expect(validateBookingInput(null).ok).toBe(false);
    expect(validateBookingInput("nope").ok).toBe(false);
  });

  it("passes optional fields through and captures the captcha token", () => {
    const result = validateBookingInput({
      name: "Lerato",
      phone: "071",
      event_date: "2026-08-01",
      venue: "Sea Point",
      message: "Sunset set please",
      captcha_token: "tok_123",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.event_date).toBe("2026-08-01");
      expect(result.value.venue).toBe("Sea Point");
      expect(result.value.message).toBe("Sunset set please");
      expect(result.value.captcha_token).toBe("tok_123");
    }
  });
});
