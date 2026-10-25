import "server-only";

/**
 * Doctor Report Agent, AI part: a short overview for the clinician that only
 * restates the brief's verified, source-linked statements. Each sentence must
 * cite statement keys, and every number it uses must appear in those
 * statements. Anything that fails validation or the safety screen is dropped.
 */

import type { VisitBrief } from "@/lib/clinical/types";
import { screenText } from "@/lib/safety/boundaries";
import { AIProviderError, completeJSON, providerInfo } from "./provider";

type Narrative = NonNullable<VisitBrief["narrative"]>;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sentences"],
  properties: {
    sentences: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "refs"],
        properties: { text: { type: "string" }, refs: { type: "array", items: { type: "string" } } },
      },
    },
  },
} as const;

function keyedStatements(brief: VisitBrief) {
  return brief.sections.flatMap((s, si) => s.statements.map((st, i) => ({ key: `${si + 1}.${i + 1}`, heading: s.heading, text: st.text })));
}

function validate(sentences: { text: string; refs: string[] }[], brief: VisitBrief): { valid: Narrative["sentences"]; rejected: number } {
  const statements = new Map(keyedStatements(brief).map((s) => [s.key, s.text]));
  const valid: Narrative["sentences"] = [];
  let rejected = 0;
  for (const s of sentences.slice(0, 5)) {
    const text = s.text.trim().slice(0, 400);
    const refs = [...new Set(s.refs)].filter((r) => statements.has(r));
    const cited = refs.map((r) => statements.get(r)!).join(" ");
    const numbersOk = (text.match(/\d+(\.\d+)?/g) ?? []).every((n) => cited.includes(n));
    if (!text || !refs.length || !numbersOk || screenText(text).length) {
      rejected++;
      continue;
    }
    valid.push({ text, refs });
  }
  return { valid, rejected };
}

function mockNarrative(brief: VisitBrief): { text: string; refs: string[] }[] {
  // Deterministic: lead with the first statement of each of the first three sections.
  return brief.sections.slice(0, 3).flatMap((s, si) => {
    const first = s.statements[0];
    return first && first.sourceIds.length ? [{ text: `${s.heading}: ${first.text}`, refs: [`${si + 1}.1`] }] : [];
  });
}

export async function draftNarrative(brief: VisitBrief, preferredName: string): Promise<{ narrative: Narrative | undefined; note: string }> {
  const info = providerInfo();
  let raw: { text: string; refs: string[] }[];
  let provider: Narrative["provider"] = "mock";
  let note = "";

  if (info.provider !== "mock") {
    try {
      const statements = keyedStatements(brief)
        .map((s) => `[${s.key}] (${s.heading}) ${s.text}`)
        .join("\n");
      const out = await completeJSON<{ sentences: { text: string; refs: string[] }[] }>({
        schemaName: "brief_overview",
        schema: SCHEMA as unknown as Record<string, unknown>,
        messages: [
          {
            role: "system",
            content: [
              "You write a 2–4 sentence overview of a visit brief for the patient's clinician.",
              "Use ONLY the numbered statements provided. Do not add facts, numbers, interpretations or causes.",
              "Do not diagnose, suggest treatment, or mention medication doses.",
              "Every sentence must list the keys (e.g. \"1.2\") of the statements it restates in `refs`.",
              `Refer to the patient as ${preferredName}.`,
            ].join("\n"),
          },
          { role: "user", content: statements },
        ],
      });
      raw = out.sentences;
      provider = info.provider;
    } catch (err) {
      note = `AI overview unavailable (${err instanceof AIProviderError ? err.message : "unexpected error"}); used the rule-based overview.`;
      raw = mockNarrative(brief);
    }
  } else {
    raw = mockNarrative(brief);
  }

  const { valid, rejected } = validate(raw, brief);
  if (rejected) note = `${note ? `${note} ` : ""}${rejected} sentence(s) removed: uncited numbers, missing references or unsafe wording.`;
  if (!valid.length) return { narrative: undefined, note: note || "No overview sentences passed validation." };
  return {
    narrative: { provider, model: provider === "mock" ? undefined : (info.model ?? undefined), sentences: valid, safetyPassed: true },
    note: note || `${valid.length} sentence(s), each citing verified statements.`,
  };
}
