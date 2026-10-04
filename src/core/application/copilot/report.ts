export interface ReportStore {
  get(scope: string, day: string): Promise<string | null>;
  save(scope: string, day: string, content: string, model: string): Promise<void>;
}

export interface Llm {
  model: string;
  complete(system: string, user: string): Promise<string>;
}

export interface ReportResult {
  text: string;
  /** local = deterministic summary (no model); cache = stored result of today's call; model = fresh call */
  source: "local" | "cache" | "model";
  model: string | null;
  /** Set when the model failed and the local summary was used instead (not cached). */
  error?: true;
}

/**
 * One language-model call per scope and day at most:
 *   cache hit -> reuse; no model configured -> local summary (0 token); model failure -> local summary, nothing cached.
 */
export async function getReport(args: {
  scope: string;
  day: string;
  store: ReportStore;
  llm: Llm | null;
  system: string;
  prompt: string;
  local: string;
  /** Called with the model error before falling back to the local summary. */
  onError?: (err: unknown) => void;
}): Promise<ReportResult> {
  const { scope, day, store, llm } = args;
  if (!llm) return { text: args.local, source: "local", model: null };

  const cached = await store.get(scope, day);
  if (cached) return { text: cached, source: "cache", model: llm.model };

  try {
    const text = (await llm.complete(args.system, args.prompt)).trim();
    if (!text) throw new Error("empty completion");
    await store.save(scope, day, text, llm.model);
    return { text, source: "model", model: llm.model };
  } catch (err) {
    args.onError?.(err);
    return { text: args.local, source: "local", model: null, error: true };
  }
}
