import type { Metadata } from "next";
import { safeNext } from "@/lib/safe-next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  google: "Google sign-in could not start. Try again.",
  link: "That link is invalid or has expired. Sign in again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-200 via-blue-200 to-indigo-300 px-4 py-10 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 dark:text-slate-100">
      <LoginForm
        next={safeNext(params.next)}
        initialError={params.error ? ERRORS[params.error] : undefined}
      />
    </div>
  );
}
