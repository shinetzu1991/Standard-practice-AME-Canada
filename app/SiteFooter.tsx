import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/sections";

// Independence notice shown at the bottom of every page.
export default function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`mt-6 text-center text-xs leading-relaxed text-slate-600 dark:text-slate-400 ${className}`}
    >
      <p>
        M2 Canada is an independent, free study tool. It is not affiliated with, approved or
        endorsed by Transport Canada, and its practice questions are not official exam
        questions.
      </p>
      <p className="mt-1.5 flex flex-wrap justify-center gap-x-4 gap-y-1 font-semibold">
        <Link href="/legal" className="text-indigo-700 hover:underline dark:text-indigo-300">
          Legal &amp; privacy
        </Link>
        <Link href="/submit" className="text-indigo-700 hover:underline dark:text-indigo-300">
          Suggest a question
        </Link>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-indigo-700 hover:underline dark:text-indigo-300"
        >
          {SUPPORT_EMAIL}
        </a>
      </p>
    </footer>
  );
}
