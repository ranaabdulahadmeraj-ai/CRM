import { loginAction } from "@/app/actions";
import Link from "next/link";

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = (await searchParams) ?? {};

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-50">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/90 p-8 shadow-2xl shadow-amber-500/10 backdrop-blur-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            Dream Land CRM
          </div>
          <h1 className="text-3xl font-semibold text-white">Secure login</h1>
          <p className="mt-2 text-sm text-slate-300">Sign in to manage projects, leads, deals and financial operations.</p>
        </div>

        {params.error ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            Invalid email or password.
          </div>
        ) : null}

        <form action={loginAction} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-slate-200" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none ring-0 transition focus:border-amber-400"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-slate-200" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-amber-400"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 px-4 py-3 font-semibold text-slate-950 transition hover:opacity-95"
          >
            Login to dashboard
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Need to review the public website? <Link href="/" className="font-semibold text-amber-300">Go to home</Link>
        </div>
      </div>
    </main>
  );
}
