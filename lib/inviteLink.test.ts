import { describe, expect, it } from "vitest";
import { buildInviteLink, parseInviteFragment } from "@/lib/inviteLink";

describe("invite link", () => {
  it("round-trips a code through link and fragment", () => {
    const link = buildInviteLink("https://pixel-canvas.peerapongsm.dev", "P2.AbC-_123");
    expect(link).toBe("https://pixel-canvas.peerapongsm.dev/#j=P2.AbC-_123");
    const hash = new URL(link).hash;
    expect(parseInviteFragment(hash)).toBe("P2.AbC-_123");
  });

  it("returns null for unrelated or empty fragments", () => {
    expect(parseInviteFragment("")).toBeNull();
    expect(parseInviteFragment("#")).toBeNull();
    expect(parseInviteFragment("#j=")).toBeNull();
    expect(parseInviteFragment("#other=x")).toBeNull();
  });

  it("decodes percent-encoded codes from re-encoding share targets", () => {
    expect(parseInviteFragment("#j=P2%2EAbC")).toBe("P2.AbC");
  });
});
