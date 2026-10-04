import { describe, expect, it } from "vitest";
import { welcomeMessageSchema } from "./branding";

describe("welcomeMessageSchema", () => {
  it("trims, and turns blank into null so the default message applies", () => {
    expect(welcomeMessageSchema.parse("  Bonne rentrée !  ")).toBe("Bonne rentrée !");
    expect(welcomeMessageSchema.parse("   ")).toBeNull();
  });

  it("caps the announcement length", () => {
    expect(welcomeMessageSchema.safeParse("x".repeat(201)).success).toBe(false);
  });
});
