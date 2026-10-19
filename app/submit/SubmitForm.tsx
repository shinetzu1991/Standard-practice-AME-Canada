"use client";

import { useState, useTransition } from "react";
import { RESTRICTED_CATEGORIES, SECTION_LABELS, TOPIC_ORDER, type Category } from "@/lib/sections";
import { submitQuestion, type ActionResult } from "../content-actions";

const INPUT =
  "w-full rounded-xl bg-white px-3 py-2.5 text-sm ring-1 ring-blue-200 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-600";
const LABEL = "mb-1 block text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300";

const EMPTY = { question: "", options: ["", "", "", ""], correct: -1, explanation: "", source: "" };

export default function SubmitForm() {
  const [category, setCategory] = useState<Category>("standard");
  const [topic, setTopic] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [result, setResult] = useState<ActionResult>({});
  const [pending, startTransition] = useTransition();

  const setOption = (i: number, value: string) =>
    setForm((f) => ({ ...f, options: f.options.map((o, j) => (j === i ? value : o)) }));

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const r = await submitQuestion({ category, topic, ...form });
      setResult(r);
      if (r.ok) setForm(EMPTY);
    });
  };

  return (
    <form onSubmit={send} className="mt-6 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>Section</span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as Category);
              setTopic("");
            }}
            className={INPUT}
          >
            {(Object.keys(SECTION_LABELS) as Category[]).filter((c) => !RESTRICTED_CATEGORIES.has(c)).map((c) => (
              <option key={c} value={c}>
                {SECTION_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={LABEL}>Topic</span>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className={INPUT}>
            <option value="">Not sure</option>
            {TOPIC_ORDER[category].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className={LABEL}>Question</span>
        <textarea
          required
          rows={3}
          maxLength={1000}
          value={form.question}
          onChange={(e) => setForm({ ...form, question: e.target.value })}
          className={INPUT}
        />
      </label>

      <fieldset>
        <legend className={LABEL}>Answers · select the correct one</legend>
        <div className="space-y-2">
          {form.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                aria-label={`Answer ${"ABCD"[i]} is correct`}
                checked={form.correct === i}
                onChange={() => setForm({ ...form, correct: i })}
                className="h-5 w-5 shrink-0 accent-emerald-600"
              />
              <span className="w-5 shrink-0 text-sm font-bold text-slate-500">{"ABCD"[i]}</span>
              <input
                required
                maxLength={300}
                value={o}
                onChange={(e) => setOption(i, e.target.value)}
                className={INPUT}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className={LABEL}>Explanation (optional)</span>
        <textarea
          rows={2}
          maxLength={1500}
          value={form.explanation}
          onChange={(e) => setForm({ ...form, explanation: e.target.value })}
          className={INPUT}
        />
      </label>

      <label className="block">
        <span className={LABEL}>Reference (optional)</span>
        <input
          maxLength={300}
          value={form.source}
          onChange={(e) => setForm({ ...form, source: e.target.value })}
          placeholder="e.g. AC 43.13-1B chapter 7, your own notes…"
          className={INPUT}
        />
      </label>

      {result.error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900">
          {result.error}
        </p>
      )}
      {result.ok && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900">
          Thanks! Your question was sent for review. You can send another one.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/30 transition hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send for review"}
      </button>
    </form>
  );
}
