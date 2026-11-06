import { getDashboardData } from "@/lib/data";
import { requireRole } from "@/lib/auth";

export const instant = false;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(value);

export default async function ReportsPage() {
  const user = await requireRole(["SUPER_ADMIN", "AGENCY_ADMIN", "ACCOUNTANT"]);
  const data = await getDashboardData(user);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Income</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(data.income)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Expenses</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(data.expenses)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Outstanding</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(data.outstandingCustomerPayments)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Financial overview</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Reporting and export-ready summaries</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-medium text-slate-800">New website inquiries</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{data.newWebsiteInquiries}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-medium text-slate-800">Completed deals</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{data.completedDeals}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-medium text-slate-800">Hot leads</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{data.hotLeads}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-medium text-slate-800">Scheduled property visits</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{data.scheduledVisits}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
