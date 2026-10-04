import { describe, expect, it, vi } from "vitest";
import { readLlm, MAX_OUTPUT_TOKENS } from "@/infrastructure/copilot/llm";
import { buildSummaryInput, localSummary } from "@/core/domain/copilot/report";
import { getReport, type Llm, type ReportStore } from "./report";
import type { CopilotSnapshot } from "@/core/domain/copilot/types";

function memoryStore(): ReportStore & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return {
    rows,
    get: async (scope, day) => rows.get(`${scope}|${day}`) ?? null,
    save: async (scope, day, content) => void rows.set(`${scope}|${day}`, content),
  };
}

const base = { system: "sys", prompt: "{}", local: "LOCAL" };

describe("getReport (1 model call per scope and day)", () => {
  it("never calls a model when none is configured", async () => {
    const res = await getReport({ ...base, scope: "school", day: "2026-10-04", store: memoryStore(), llm: null });
    expect(res).toEqual({ text: "LOCAL", source: "local", model: null });
  });

  it("calls the model once, then serves the cache the same day", async () => {
    const complete = vi.fn(async () => "  Rapport IA  ");
    const llm: Llm = { model: "m", complete };
    const store = memoryStore();
    const first = await getReport({ ...base, scope: "school", day: "2026-10-04", store, llm });
    const second = await getReport({ ...base, scope: "school", day: "2026-10-04", store, llm });
    expect(first).toMatchObject({ text: "Rapport IA", source: "model" });
    expect(second).toMatchObject({ text: "Rapport IA", source: "cache" });
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("uses a separate cache entry per scope and per day", async () => {
    const complete = vi.fn(async () => "x");
    const llm: Llm = { model: "m", complete };
    const store = memoryStore();
    await getReport({ ...base, scope: "school", day: "2026-10-04", store, llm });
    await getReport({ ...base, scope: "class:3e", day: "2026-10-04", store, llm });
    await getReport({ ...base, scope: "school", day: "2026-10-05", store, llm });
    expect(complete).toHaveBeenCalledTimes(3);
  });

  it("falls back to the local summary on failure and does not cache the failure", async () => {
    const llm: Llm = { model: "m", complete: async () => { throw new Error("boom"); } };
    const store = memoryStore();
    const res = await getReport({ ...base, scope: "school", day: "2026-10-04", store, llm });
    expect(res).toMatchObject({ text: "LOCAL", source: "local", error: true });
    expect(store.rows.size).toBe(0);
  });
});

describe("readLlm", () => {
  it("is off without provider and key", () => {
    expect(readLlm({})).toBeNull();
    expect(readLlm({ AI_PROVIDER: "anthropic" })).toBeNull();
  });

  it("uses the lightweight default models and caps the output", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text: "ok" }] })));
    const llm = readLlm({ AI_PROVIDER: "anthropic", AI_API_KEY: "sk-test-key-123" }, fetchImpl as unknown as typeof fetch)!;
    expect(llm.model).toBe("claude-haiku-4-5-20251001");
    expect(await llm.complete("s", "u")).toBe("ok");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, { body: string; headers: Record<string, string> }];
    expect(url).toContain("api.anthropic.com");
    expect(JSON.parse(init.body).max_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(init.headers["x-api-key"]).toBe("sk-test-key-123");
  });

  it("supports OpenAI chat completions", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "salut" } }] })));
    const llm = readLlm({ AI_PROVIDER: "openai", AI_API_KEY: "sk-test-key-123" }, fetchImpl as unknown as typeof fetch)!;
    expect(llm.model).toBe("gpt-4o-mini");
    expect(await llm.complete("s", "u")).toBe("salut");
  });

  it("retries once with the default model when the configured one is unknown (404)", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: { body: string }) =>
      JSON.parse(init.body).model === "claude-3-5-haiku-latest"
        ? new Response("not found", { status: 404 })
        : new Response(JSON.stringify({ content: [{ type: "text", text: "repli ok" }] })),
    );
    const llm = readLlm({ AI_PROVIDER: "anthropic", AI_API_KEY: "sk-test-key-123", AI_MODEL: "claude-3-5-haiku-latest" }, fetchImpl as unknown as typeof fetch)!;
    expect(await llm.complete("s", "u")).toBe("repli ok");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry on auth or rate-limit errors", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 401 }));
    const llm = readLlm({ AI_PROVIDER: "anthropic", AI_API_KEY: "sk-test-key-123", AI_MODEL: "claude-3-5-haiku-latest" }, fetchImpl as unknown as typeof fetch)!;
    await expect(llm.complete("s", "u")).rejects.toThrow("401");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws on HTTP errors so the caller can fall back", async () => {
    const llm = readLlm({ AI_PROVIDER: "openai", AI_API_KEY: "sk-test-key-123" }, (async () => new Response("no", { status: 429 })) as unknown as typeof fetch)!;
    await expect(llm.complete("s", "u")).rejects.toThrow("429");
  });
});

describe("summary input is anonymous", () => {
  const snapshot: CopilotSnapshot = {
    schoolName: "Academy", currency: "FCFA",
    arrears: [{ studentId: "1", studentName: "Kouamé Yao", level: "3e", owedCents: 25_000, oldestDue: new Date(), parent: { name: "M. Yao", phone: "+225 07 00 00 00 00", email: "a@b.c" } }],
    upcoming: [], absences: [], teachers: [], levels: [],
  };
  const growth = { currency: "FCFA", levels: [{ level: "3e", feeCents: 25_000, students: 12 }], courses: [], siblingFamilies: 0, siblingStudents: 0 };

  it("contains no name, phone or e-mail", () => {
    const input = buildSummaryInput(snapshot, growth, [], "school");
    const json = JSON.stringify(input);
    expect(json).not.toMatch(/Kouam|Yao|\+225|@/);
    expect(input.arrears).toEqual({ students: 1, totalOwed: 25_000 });
    expect(input.levels[0]).toMatchObject({ level: "3e", marketMedian: 27_500 });
  });

  it("produces a readable local fallback", () => {
    expect(localSummary(buildSummaryInput(snapshot, growth, [], "school"))).toContain("25 000 FCFA");
  });
});
