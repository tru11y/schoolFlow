import { describe, expect, it } from "vitest";
import { resolveDownloadUrl } from "./source-url";

describe("resolveDownloadUrl", () => {
  it("laisse un lien de fichier direct inchangé", () => {
    const r = resolveDownloadUrl("https://ex.com/edt.xlsx");
    expect(r).toEqual({ url: "https://ex.com/edt.xlsx" });
  });

  it("refuse les protocoles non http(s)", () => {
    expect("error" in resolveDownloadUrl("file:///etc/passwd")).toBe(true);
    expect("error" in resolveDownloadUrl("pas une url")).toBe(true);
  });

  it("convertit un lien OneDrive en API shares", () => {
    const r = resolveDownloadUrl("https://1drv.ms/x/c/abc/XYZ");
    expect("url" in r && r.url.startsWith("https://api.onedrive.com/v1.0/shares/u!")).toBe(true);
    expect("url" in r && r.url.endsWith("/root/content")).toBe(true);
  });

  it("convertit un Google Sheet en export xlsx", () => {
    const r = resolveDownloadUrl("https://docs.google.com/spreadsheets/d/ABC123/edit#gid=0");
    expect(r).toEqual({ url: "https://docs.google.com/spreadsheets/d/ABC123/export?format=xlsx" });
  });

  it("convertit un fichier Google Drive en téléchargement direct", () => {
    const r = resolveDownloadUrl("https://drive.google.com/file/d/FILEID/view");
    expect(r).toEqual({ url: "https://drive.google.com/uc?export=download&id=FILEID" });
  });
});
