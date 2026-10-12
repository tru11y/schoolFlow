import { describe, expect, it } from "vitest";
import type { CompetitorView } from "./competitors";
import { buildOsintPrompt, competitorLinks, extractLinks, withSources } from "./osint";

const excellence: CompetitorView = {
  id: "c1",
  name: "Excellence Abidjan",
  area: "Cocody",
  contact: "https://web.facebook.com/ExcellenceGroup1/posts/123, tel 07 00",
  offers: "Prépa BAC. Instagram : https://www.instagram.com/excellence_ci.",
  notes: null,
  fees: [{ level: "Tle", feeCents: 25_000 }],
};

describe("extractLinks", () => {
  it("classifies platforms, strips trailing punctuation and de-duplicates", () => {
    const links = extractLinks(excellence.contact, excellence.offers, "https://web.facebook.com/ExcellenceGroup1/posts/123");
    expect(links.map((l) => l.platform)).toEqual(["facebook", "instagram"]);
    expect(links[1]!.url).toBe("https://www.instagram.com/excellence_ci");
  });

  it("ignores non-http schemes and treats other hosts as a website", () => {
    expect(extractLinks("javascript:alert(1) ftp://x.y")).toEqual([]);
    expect(extractLinks("voir https://excellence.ci/tarifs")[0]).toMatchObject({ platform: "website" });
    expect(extractLinks("https://vm.tiktok.com/abc")[0]?.platform).toBe("tiktok");
  });
});

describe("buildOsintPrompt", () => {
  it("carries the registered fees, our grid, the known pages and the three questions", () => {
    const prompt = buildOsintPrompt(excellence, competitorLinks(excellence), {
      schoolName: "OPEN + KOUAHO", currency: "FCFA", levels: [{ level: "Tle", feeCents: 30_000 }, { level: "3e", feeCents: null }],
    });
    expect(prompt).toContain("Excellence Abidjan (Cocody)");
    expect(prompt).toContain("Tle : 25");
    expect(prompt).toContain("facebook https://web.facebook.com/ExcellenceGroup1/posts/123");
    expect(prompt).toContain("3e : non défini");
    expect(prompt).toContain("plan d'action direct en 3 points pour OPEN + KOUAHO");
  });
});

describe("withSources", () => {
  it("lists each consulted URL once", () => {
    const text = withSources("Analyse", [{ title: "A", url: "https://a.ci" }, { title: "A bis", url: "https://a.ci" }, { title: "", url: "https://b.ci" }]);
    expect(text.match(/https:\/\/a\.ci/g)).toHaveLength(1);
    expect(text).toContain("- https://b.ci — https://b.ci");
    expect(withSources("Analyse", [])).toBe("Analyse");
  });
});
