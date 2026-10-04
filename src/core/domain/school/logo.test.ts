import { describe, expect, it } from "vitest";
import { decodeLogoDataUrl, MAX_LOGO_BYTES } from "./logo";

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]).toString("base64");

describe("decodeLogoDataUrl", () => {
  it("accepts a PNG whose bytes match its mime", () => {
    expect(decodeLogoDataUrl(`data:image/png;base64,${png}`)?.mime).toBe("image/png");
  });

  it("rejects a mime/bytes mismatch, other types and oversize payloads", () => {
    expect(decodeLogoDataUrl(`data:image/jpeg;base64,${png}`)).toBeNull();
    expect(decodeLogoDataUrl(`data:image/svg+xml;base64,${png}`)).toBeNull();
    expect(decodeLogoDataUrl("javascript:alert(1)")).toBeNull();
    const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(MAX_LOGO_BYTES)]).toString("base64");
    expect(decodeLogoDataUrl(`data:image/png;base64,${big}`)).toBeNull();
  });
});
