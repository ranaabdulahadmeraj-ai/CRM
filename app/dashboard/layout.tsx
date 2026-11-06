import { logoutAction } from "@/app/actions";
import { requireAuth } from "@/lib/auth";
import Link from "next/link";
import { Bell, BarChart3, Building2, CalendarDays, CircleDollarSign, FileText, LayoutDashboard, LogOut, UserRound, Users } from "lucide-react";
import { connection } from "next/server";

export const instant = false;

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projects", icon: Building2 },
  { href: "/dashboard/properties", label: "Properties", icon: FileText },
  { href: "/dashboard/customers", label: "Customers", icon: UserRound },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/deals", label: "Deals", icon: CircleDollarSign },
  { href: "/dashboard/appointments", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/reminders", label: "Reminders", icon: Bell },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await connection();
  const user = await requireAuth();
  const isFinanceRole = ["SUPER_ADMIN", "AGENCY_ADMIN", "ACCOUNTANT"].includes(user.role);
  const visibleNavItems = user.role === "ACCOUNTANT"
    ? navItems.filter(({ href }) => ["/dashboard", "/dashboard/deals", "/dashboard/reports"].includes(href))
    : isFinanceRole
      ? navItems
      : navItems.filter(({ href }) => href !== "/dashboard/reports");

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <div className="flex min-h-screen">
        <aside className="w-72 border-r border-slate-200 bg-slate-950 text-slate-100">
          <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/20 text-lg font-semibold text-amber-300">
              DL
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Dream Land</p>
              <p className="font-semibold">ERP Suite</p>
            </div>
          </div>

          <nav className="px-4 py-5">
            <ul className="space-y-2">
              {visibleNavItems.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-10 border-t border-white/10 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Session</p>
            <div className="mt-3 rounded-xl bg-slate-900 p-3">
              <p className="font-medium text-white">{user.name}</p>
              <p className="text-xs text-slate-400">{user.role}</p>
            </div>
            <form action={logoutAction} className="mt-4">
              <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </form>
          </div>
        </aside>

        <div className="flex-1">
          <header className="border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Operations dashboard</p>
                <h1 className="text-2xl font-semibold text-slate-900">Dream Land Properties</h1>
              </div>
              <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                Live CRM data
              </div>
            </div>
          </header>
          <main className="p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
