import { getDashboardData } from "@/lib/data";
import { requireAuth } from "@/lib/auth";
import { RevenueChart, LeadChart, PerformanceChart, DistributionChart } from "@/components/charts";
import { ArrowUpRight, BadgeDollarSign, Building2, CircleDollarSign, MapPinned, Users } from "lucide-react";
import Link from "next/link";

export const instant = false;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);

export default async function DashboardPage() {
  const user = await requireAuth();
  const data = await getDashboardData(user);

  const statCards = [
    { label: "Total properties", value: data.totalProperties, detail: "Inventory tracked", icon: Building2, accent: "bg-sky-100 text-sky-700" },
    { label: "Active projects", value: data.activeProjects, detail: "Market listings", icon: MapPinned, accent: "bg-violet-100 text-violet-700" },
    ...(data.canViewCrm ? [{ label: "Total customers", value: data.totalCustomers, detail: "CRM contacts", icon: Users, accent: "bg-emerald-100 text-emerald-700" }] : []),
    { label: "Total sales", value: formatCurrency(data.totalSalesVolume), detail: "Completed deals", icon: CircleDollarSign, accent: "bg-amber-100 text-amber-700" },
    ...(data.canViewCrm ? [{ label: "Active leads", value: data.activeLeads, detail: `${data.newWebsiteInquiries} website inquiries`, icon: Users, accent: "bg-sky-100 text-sky-700" }] : []),
    { label: "Receipts received", value: formatCurrency(data.totalReceived), detail: "Verified deal payments", icon: CircleDollarSign, accent: "bg-emerald-100 text-emerald-700" },
    { label: "Customer balance due", value: formatCurrency(data.outstandingCustomerPayments), detail: "Unpaid deal balances", icon: CircleDollarSign, accent: "bg-rose-100 text-rose-700" },
    ...(data.canViewCrm ? [{ label: "Overdue reminders", value: data.overdueReminders, detail: `${data.unreadNotifications} unread notifications`, icon: Users, accent: "bg-orange-100 text-orange-700" }] : []),
    { label: "Commission outstanding", value: formatCurrency(data.commissionOutstanding), detail: "Unpaid agency and agent shares", icon: BadgeDollarSign, accent: "bg-violet-100 text-violet-700" },
  ];

  const distributionData = [
    { name: "New inquiry", value: data.leadStatusCounts.NEW_INQUIRY },
    { name: "Contacted", value: data.leadStatusCounts.CONTACTED },
    { name: "Qualified", value: data.leadStatusCounts.QUALIFIED },
    { name: "Converted", value: data.leadStatusCounts.CONVERTED },
  ];

  return (
    <div className="space-y-6">
      {data.canViewCrm && data.overdueReminders > 0 ? <Link href="/dashboard/reminders" className="block rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 hover:bg-rose-100">{data.overdueReminders} follow-up reminder{data.overdueReminders === 1 ? "" : "s"} overdue · View reminders</Link> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, detail, icon: Icon, accent }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className={`${accent} flex h-11 w-11 items-center justify-center rounded-xl`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Live
              </span>
            </div>
            <p className="mt-5 text-2xl font-semibold text-slate-900">{value}</p>
            <p className="mt-1 text-sm text-slate-600">{label}</p>
            <p className="mt-2 text-xs text-slate-500">{detail}</p>
          </div>
        ))}
      </div>

      <div className={`grid gap-6 ${data.canViewCrm ? "xl:grid-cols-[1.6fr_1fr]" : ""}`}>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Monthly receipts</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Verified customer payments</h2>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
              <BadgeDollarSign className="h-4 w-4" />
              {formatCurrency(data.totalCommission)} commission
            </span>
          </div>
          <RevenueChart data={data.monthlyRevenue} />
        </div>

        {data.canViewCrm ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Lead mix</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">Pipeline status</h2>
            <DistributionChart data={distributionData} />
          </div>
        ) : null}
      </div>

      {data.canViewCrm ? (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Lead volume</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Website inquiry trend</h2>
              <LeadChart data={data.leadConversion} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Agent momentum</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Performance leaderboard</h2>
              <PerformanceChart data={data.agentPerformance} />
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2 pr-3">Agent</th><th className="py-2 pr-3">Leads</th><th className="py-2 pr-3">Calls</th><th className="py-2 pr-3">Visits</th><th className="py-2 pr-3">Conversions</th><th className="py-2 pr-3">Completed deals</th></tr></thead>
                  <tbody>{data.agentPerformance.map((agent) => <tr key={agent.name} className="border-b border-slate-100 last:border-0"><td className="py-2 pr-3 font-medium text-slate-800">{agent.name}</td><td className="py-2 pr-3">{agent.leads}</td><td className="py-2 pr-3">{agent.calls}</td><td className="py-2 pr-3">{agent.visits}</td><td className="py-2 pr-3">{agent.conversions}</td><td className="py-2 pr-3">{agent.conversion}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">Latest leads</h2>
                <span className="text-sm text-slate-500">{data.leads.length} records</span>
              </div>
              <div className="space-y-3">
                {data.leads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="font-medium text-slate-800">{lead.fullName}</p>
                      <p className="text-sm text-slate-500">{lead.source} · {lead.city ?? "Unspecified"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-800">{lead.status}</p>
                      <p className="text-xs text-slate-500">{lead.priority}</p>
                    </div>
                  </div>
                ))}
                {data.leads.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No leads to display.</p> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">Recent activity</h2>
                <span className="text-sm text-slate-500">Live</span>
              </div>
              <div className="space-y-3">
                {data.recentActivity.map((activity) => (
                  <div key={activity.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="font-medium text-slate-800">{activity.title}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span>{activity.time}</span>
                      <span className="font-medium text-amber-700">{activity.tag}</span>
                    </div>
                  </div>
                ))}
                {data.recentActivity.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No recent activity.</p> : null}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
