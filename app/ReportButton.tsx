"use client";

import { Flag } from "lucide-react";
import { useState, useTransition } from "react";
import { reportQuestion } from "./content-actions";

const REASONS = [
  { value: "error", label: "Wrong answer, typo or badly written" },
  { value: "copyright", label: "Copyright or confidential exam content" },
  { value: "other", label: "Something else" },
];

// Small "Report" link that opens a form to flag a question for review.
export default function ReportButton({
  category,
  question,
}: {
  category: string;
  question: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("error");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<{ ok?: boolean; error?: string }>({});
  const [pending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setStatus({});
    setMessage("");
    setReason("error");
  };

  const send = () =>
    startTransition(async () => {
      setStatus(await reportQuestion({ category, question, reason, message }));
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-rose-600 hover:underline dark:text-slate-400"
      >
        <Flag className="h-3.5 w-3.5" />
        Report this question
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Report a question"
            className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl dark:bg-slate-900"
          >
            <h2 className="text-lg font-extrabold">Report this question</h2>
            <p className="mt-1 line-clamp-3 text-sm text-slate-500 dark:text-slate-400">{question}</p>

            {status.ok ? (
              <>
                <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Thanks, the report was sent.
                  {reason === "copyright" &&
                    " The question is hidden from the site while it is reviewed."}
                </p>
                <div className="mt-4 text-right">
                  <button
                    onClick={close}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <fieldset className="mt-4 space-y-2">
                  {REASONS.map((r) => (
                    <label key={r.value} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="reason"
                        value={r.value}
                        checked={reason === r.value}
                        onChange={() => setReason(r.value)}
                        className="h-4 w-4 accent-indigo-600"
                      />
                      {r.label}
                    </label>
                  ))}
                </fieldset>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="Details (optional): what is wrong, the right answer, the source…"
                  className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-blue-200 outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:ring-slate-600"
                />
                {status.error && (
                  <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{status.error}</p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={close}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={send}
                    disabled={pending}
                    className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {pending ? "Sending…" : "Send report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
