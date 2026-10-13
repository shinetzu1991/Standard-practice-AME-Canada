import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "../SiteFooter";
import SubmitForm from "./SubmitForm";

export const metadata: Metadata = { title: "Suggest a question" };

export default function SubmitPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-blue-200 to-indigo-300 px-3 py-6 text-slate-900 sm:px-6 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 dark:text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="mb-4 inline-block text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
        >
          ← Back to the app
        </Link>
        <div className="rounded-3xl bg-gradient-to-b from-blue-50 to-sky-100 p-5 shadow-xl shadow-blue-900/15 ring-1 ring-blue-200 sm:p-8 dark:from-slate-900 dark:to-slate-900 dark:ring-slate-700">
          <h1 className="text-3xl font-extrabold">Suggest a question</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Write a practice question with four answers. It is reviewed before it is added to
            the question bank. Please write it in your own words: do not copy questions from
            the official exam or from copyrighted books.
          </p>
          <SubmitForm />
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}
