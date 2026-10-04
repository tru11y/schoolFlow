"use server";

import { z } from "zod";
import { localParts } from "@/core/domain/attendance/policy";
import { ForbiddenError } from "@/core/domain/errors";
import { getReport, type ReportResult, type ReportStore } from "@/core/application/copilot/report";
import { buildInsights } from "@/core/domain/copilot/benchmark";
import { REPORT_SYSTEM_PROMPT, buildReportPrompt, buildSummaryInput, localSummary } from "@/core/domain/copilot/report";
import { loadSnapshot } from "@/infrastructure/copilot/copilot-service";
import { loadGrowth } from "@/infrastructure/copilot/growth-service";
import { readLlm } from "@/infrastructure/copilot/llm";
import { env } from "@/infrastructure/env/env";
import { secureAction } from "@/presentation/secure-action";

export const generateAiSummary = secureAction(
  {
    name: "COPILOT_AI_SUMMARY",
    resource: "copilot",
    permission: "user:manage",
    input: z.object({ scope: z.string().regex(/^(school|class:.{1,20})$/) }),
    // Scope, source and model only: never the report text.
    auditMetadata: (i, data: ReportResult | undefined) => ({ scope: i.scope, source: data?.source, model: data?.model }),
  },
  async ({ input, db, principal }): Promise<ReportResult> => {
    const schoolId = principal.schoolId;
    if (!schoolId) throw new ForbiddenError("tenant:missing");

    const [snapshot, growth] = await Promise.all([loadSnapshot(principal), loadGrowth(principal)]);
    if (input.scope.startsWith("class:") && !growth.levels.some((l) => `class:${l.level}` === input.scope)) {
      throw new ForbiddenError("copilot:unknown-scope");
    }

    const summary = buildSummaryInput(snapshot, growth, buildInsights(growth), input.scope);
    const e = env();
    const store: ReportStore = {
      async get(scope, day) {
        const row = await db.aiReport.findFirst({ where: { scope, day: new Date(day) }, select: { content: true } });
        return row?.content ?? null;
      },
      async save(scope, day, content, model) {
        await db.aiReport.create({ data: { schoolId, scope, day: new Date(day), content, model } }).catch(() => undefined);
      },
    };

    return getReport({
      scope: input.scope,
      day: localParts(new Date()).date,
      store,
      llm: readLlm({ AI_PROVIDER: e.AI_PROVIDER, AI_API_KEY: e.AI_API_KEY, AI_MODEL: e.AI_MODEL }),
      system: REPORT_SYSTEM_PROMPT,
      prompt: buildReportPrompt(summary),
      local: localSummary(summary),
    });
  },
);
