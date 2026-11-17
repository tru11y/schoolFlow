import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("prepends BOM and CRLF-terminates", () => {
    expect(toCsv(["A"], [["x"]])).toBe("﻿A\r\nx\r\n");
  });

  it("quotes fields containing the delimiter, quotes or newlines", () => {
    expect(toCsv(["A"], [["a;b"]])).toContain('"a;b"');
    expect(toCsv(["A"], [['he "said"']])).toContain('"he ""said"""');
    expect(toCsv(["A"], [["line\nbreak"]])).toContain('"line\nbreak"');
  });

  it("renders dates as ISO day and empty for null/undefined", () => {
    expect(toCsv(["A"], [[new Date("2026-01-02T10:00:00Z")]])).toContain("2026-01-02");
    expect(toCsv(["A"], [[null, undefined]])).toContain("\r\n;\r\n");
  });

  it("neutralizes formula-injection cells", () => {
    for (const payload of ["=1+1", "+1", "-1", "@cmd", "=HYPERLINK(1)"]) {
      expect(toCsv(["A"], [[payload]])).toContain(`'${payload}`);
    }
  });

  it("quotes and neutralizes a formula cell that also holds a delimiter", () => {
    expect(toCsv(["A"], [["=cmd;rest"]])).toContain('"\'=cmd;rest"');
  });

  it("leaves safe text untouched", () => {
    expect(toCsv(["A"], [["Dupont"]])).toContain("\r\nDupont\r\n");
  });
});
