"use client";

import { useId, useState } from "react";
import { ChevronDown, CircleCheck, FilePenLine, FileText, Undo2 } from "lucide-react";
import { providerLabel } from "@/lib/ai/labels";
import type { VisitBrief } from "@/lib/clinical/types";
import type { TimelineItem } from "@/lib/clinical/timeline";
import { clearDecision, recordDecision, useReviewDecisions, type ReviewDecision } from "@/lib/clinical/review-store";
import { formatDate, formatDateTime, formatRelativeDay, formatTime } from "@/lib/clinical/time";
import { Card, CardHeader } from "@/components/clinical/ui";
import { SourceBadge } from "@/components/clinical/SourceBadge";

function Sources({ ids, sources }: { ids: string[]; sources: Record<string, TimelineItem> }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (!ids.length) return <p className="mt-1 text-xs text-mist-500">No source observations (statement of absence)</p>;
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        className="inline-flex items-center gap-1 rounded-lg text-sm font-medium text-glow-300 hover:text-glow-200"
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        Based on {ids.length} source observation{ids.length === 1 ? "" : "s"}
      </button>
      {open && (
        <ul id={listId} className="mt-2 grid max-h-64 gap-1.5 overflow-auto rounded-xl border border-white/[0.06] bg-night-950/40 p-2">
          {ids.map((id) => {
            const s = sources[id];
            if (!s) return null;
            return (
              <li key={id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-sm">
                <span className="w-32 shrink-0 text-mist-500 tabular-nums">{formatDateTime(s.at)}</span>
                <span className="min-w-0 flex-1 text-mist-100">
                  {s.title}
                  {s.quote && <span className="text-mist-400 italic"> &ldquo;{s.quote}&rdquo;</span>}
                </span>
                <SourceBadge source={s.source} compact />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function VisitBriefPanel({ brief, sources, reviewer, preferredName }: { brief: VisitBrief | undefined; sources: Record<string, TimelineItem>; reviewer: string; preferredName: string }) {
  const decisions = useReviewDecisions();
  const [requesting, setRequesting] = useState(false);
  const [note, setNote] = useState("");

  if (!brief) {
    return (
      <Card labelledBy="brief-title" id="visit-brief" className="scroll-mt-28">
        <CardHeader id="brief-title" title="Visit brief" />
        <p className="text-mist-400">No visit brief has been drafted yet. The Doctor Report Agent drafts one ahead of each scheduled visit.</p>
      </Card>
    );
  }

  const decision = decisions[brief.id] as ReviewDecision | undefined;
  const status = decision?.status ?? (brief.status === "approved" ? "approved" : "pending_review");
  const reviewedBy = decision?.reviewer ?? brief.reviewedBy;
  const reviewedAt = decision?.at ?? brief.reviewedAt;

  return (
    <Card labelledBy="brief-title" id="visit-brief" className="scroll-mt-28">
      <CardHeader
        id="brief-title"
        title="Visit brief"
        subtitle={`Covers ${formatDate(brief.periodStart)}–${formatDate(brief.periodEnd)} · drafted ${formatRelativeDay(brief.createdAt).toLowerCase()}, ${formatTime(brief.createdAt)}`}
        action={
          status === "approved" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-status-good/30 bg-status-good/10 px-3 py-1 text-sm font-semibold text-status-good">
              <CircleCheck className="h-4 w-4" aria-hidden="true" /> Approved
            </span>
          ) : status === "changes_requested" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-status-serious/30 bg-status-serious/10 px-3 py-1 text-sm font-semibold text-status-serious">
              <FilePenLine className="h-4 w-4" aria-hidden="true" /> Changes requested
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-status-warning/30 bg-status-warning/10 px-3 py-1 text-sm font-semibold text-status-warning">
              <FileText className="h-4 w-4" aria-hidden="true" /> Draft · awaiting your review
            </span>
          )
        }
      />

      <p className="mb-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-sm leading-relaxed text-mist-400">
        Drafted by the <span className="text-mist-100">Doctor Report Agent</span>. The numbered statements come from a{" "}
        <span className="text-mist-100">rule-based template</span> over {preferredName}&apos;s recorded observations
        {brief.narrative
          ? brief.narrative.provider !== "mock"
            ? `; the overview was written by an AI model (${providerLabel(brief.narrative.provider, brief.narrative.model)}) using only those statements`
            : "; the overview restates them without AI"
          : ""}
        . The brief describes what was recorded and does not diagnose or recommend treatment. Every statement links to its sources.
      </p>

      {brief.narrative && (
        <section aria-labelledby={`${brief.id}-overview`} className="mb-6 rounded-2xl border border-source-ai/25 bg-source-ai/[0.05] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id={`${brief.id}-overview`} className="text-sm font-semibold tracking-widest text-mist-300 uppercase">
              Overview
            </h3>
            {brief.narrative.provider !== "mock" ? (
              <SourceBadge source="ai_estimate" />
            ) : (
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-mist-400">Rule-based, no AI</span>
            )}
          </div>
          <ul className="mt-2.5 grid gap-2">
            {brief.narrative.sentences.map((s, i) => (
              <li key={i} className="leading-relaxed text-mist-100">
                {s.text} <span className="text-xs whitespace-nowrap text-mist-400">(cites {s.refs.map((r) => `§${r}`).join(", ")})</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-mist-500">Each sentence was checked: it must cite statements below, use only their numbers, and pass the safety screen.</p>
        </section>
      )}

      <div className="grid gap-6">
        {brief.sections.map((section, si) => (
          <section key={section.heading}>
            <h3 className="text-sm font-semibold tracking-widest text-mist-400 uppercase">{section.heading}</h3>
            <ul className="mt-2.5 grid gap-3">
              {section.statements.map((st, i) => (
                <li key={i} className="border-l-2 border-white/10 pl-3.5">
                  <p className="leading-relaxed text-mist-100">
                    <span className="mr-1.5 text-xs font-semibold text-mist-500 tabular-nums">§{si + 1}.{i + 1}</span>
                    {st.text}
                  </p>
                  <Sources ids={st.sourceIds} sources={sources} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-6 border-t border-white/[0.06] pt-5">
        {status === "pending_review" && !requesting && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => recordDecision(brief.id, { status: "approved", reviewer })}
              className="inline-flex items-center gap-2 rounded-xl bg-glow-300 px-5 py-3 font-semibold text-night-950 transition hover:bg-glow-200"
            >
              <CircleCheck className="h-5 w-5" aria-hidden="true" /> Approve brief
            </button>
            <button
              type="button"
              onClick={() => setRequesting(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/12 px-5 py-3 font-semibold text-white transition hover:border-white/25 hover:bg-white/[0.04]"
            >
              <FilePenLine className="h-5 w-5" aria-hidden="true" /> Request changes
            </button>
            <p className="text-sm text-mist-500">Approval is recorded with your name and time.</p>
          </div>
        )}
        {status === "pending_review" && requesting && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.trim()) return;
              recordDecision(brief.id, { status: "changes_requested", reviewer, note: note.trim() });
              setRequesting(false);
              setNote("");
            }}
            className="grid gap-3"
          >
            <label htmlFor={`${brief.id}-note`} className="font-semibold text-white">
              What should change?
            </label>
            <textarea
              id={`${brief.id}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              required
              className="rounded-xl border border-white/10 bg-night-850 p-3 text-white placeholder:text-mist-500 focus:border-glow-300/40 focus:outline-none"
              placeholder="e.g. Separate fasting and post-meal readings in the glucose summary."
            />
            <div className="flex gap-3">
              <button type="submit" className="rounded-xl bg-glow-300 px-5 py-2.5 font-semibold text-night-950 hover:bg-glow-200">
                Send back to draft
              </button>
              <button type="button" onClick={() => setRequesting(false)} className="rounded-xl px-4 py-2.5 font-medium text-mist-300 hover:text-white">
                Cancel
              </button>
            </div>
          </form>
        )}
        {status !== "pending_review" && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-mist-400">
            <span>
              {status === "approved" ? "Approved" : "Changes requested"} by {reviewedBy}
              {reviewedAt ? ` · ${formatDateTime(reviewedAt)}` : ""}
            </span>
            {decision?.note && <span className="text-mist-300">&ldquo;{decision.note}&rdquo;</span>}
            {decision && (
              <button type="button" onClick={() => clearDecision(brief.id)} className="inline-flex items-center gap-1 text-mist-400 hover:text-white">
                <Undo2 className="h-4 w-4" aria-hidden="true" /> Undo (demo)
              </button>
            )}
          </div>
        )}
        <p className="mt-3 text-xs text-mist-500">Demo: review decisions are saved in this browser only.</p>
      </div>
    </Card>
  );
}
