import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/sections";
import SiteFooter from "../SiteFooter";

export const metadata: Metadata = {
  title: "Legal & privacy",
  description: "Independence notice, content review and removal policy, and privacy policy.",
};

const UPDATED = "October 13, 2026";

const H2 = "mt-8 text-xl font-extrabold";
const P = "mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300";
const UL = "mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300";

function Mail() {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
      {SUPPORT_EMAIL}
    </a>
  );
}

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-blue-200 to-indigo-300 px-3 py-6 text-slate-900 sm:px-6 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="mb-4 inline-block text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
        >
          ← Back to M2 Canada
        </Link>
        <article className="rounded-3xl bg-white/95 p-5 shadow-xl shadow-blue-900/15 ring-1 ring-blue-200 sm:p-10 dark:bg-slate-900/95 dark:ring-slate-700">
          <h1 className="text-3xl font-extrabold">Legal &amp; privacy</h1>
          <p className="mt-1 text-xs text-slate-500">Last updated: {UPDATED}</p>

          <h2 className={H2} id="independence">1. Independence notice</h2>
          <p className={P}>
            M2 Canada (m2canada.ca) is an independent and free study platform for people
            preparing for aircraft maintenance engineer (AME) examinations. It is{" "}
            <strong>not affiliated with, approved, sponsored or endorsed by Transport Canada</strong>{" "}
            or any other government body, school or examination provider.
          </p>
          <ul className={UL}>
            <li>
              The questions are practice material written or compiled for study. They are not
              official examination questions, and the site does not claim to reproduce the
              content of any official exam.
            </li>
            <li>
              Answers and explanations may contain errors. Always check against current
              regulations, manufacturer data and approved references.
            </li>
            <li>
              Using this site does not guarantee any result in an official examination and
              is not a substitute for approved training.
            </li>
            <li>
              References to Transport Canada are only used to describe the examinations this
              tool helps people prepare for.
            </li>
          </ul>

          <h2 className={H2} id="content-policy">2. Content review and removal policy</h2>
          <p className={P}>
            We respect intellectual property and the confidentiality of official
            examinations. If you believe a question reproduces copyrighted material,
            confidential examination content, or is otherwise inappropriate, please tell us:
          </p>
          <ul className={UL}>
            <li>
              Use <strong>“Report this question”</strong> under any question, or write to{" "}
              <Mail />.
            </li>
            <li>
              Include the question text (or a screenshot), the section, and the reason. Rights
              holders should identify the work concerned and how to contact them.
            </li>
            <li>
              We acknowledge requests within <strong>5 business days</strong>. Questions
              reported for copyright or confidential exam content are hidden from the site
              while we review them, and permanently removed if the concern is confirmed.
            </li>
            <li>
              Requests from Transport Canada or other authorities are handled with priority,
              and we will remove any content they ask us to remove.
            </li>
          </ul>
          <p className={P}>
            Questions suggested by users are reviewed before publication. People who suggest
            questions confirm that they wrote them in their own words and have the right to
            share them.
          </p>

          <h2 className={H2} id="privacy">3. Privacy policy</h2>
          <p className={P}>When you create an account and sign in, we collect:</p>
          <ul className={UL}>
            <li>your name and email address (or those of your Google account);</li>
            <li>the sign-in method and the date and time of each sign-in;</li>
            <li>
              your approximate location (city, region and country), derived from your IP
              address by our hosting provider, and your browser type;
            </li>
            <li>reports and questions you choose to send us.</li>
          </ul>
          <p className={P}>
            We use this information only to give you access to the site, protect it against
            abuse, understand how many people use it and from where, and review content. We
            do not sell it or use it for advertising. Your test progress and test history are
            stored only in your own browser, not on our servers.
          </p>
          <p className={P}>
            Service providers that process data for us: Supabase (accounts and database,
            hosted in Canada), Vercel (hosting and anonymous visit statistics), Google (only
            if you sign in with Google) and Resend (email notifications to the site
            administrator).
          </p>
          <p className={P}>
            We keep account information while your account exists. You can ask to access,
            correct or delete your personal information, or to close your account, by
            writing to <Mail />. The person responsible for the protection of personal
            information at M2 Canada can be reached at the same address.
          </p>

          <h2 className={H2} id="contact">4. Contact</h2>
          <p className={P}>
            Questions, corrections, copyright notices and privacy requests: <Mail />.
          </p>
        </article>
        <SiteFooter />
      </div>
    </div>
  );
}
