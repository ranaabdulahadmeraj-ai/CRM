import { createCustomerAction } from "@/app/actions";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const instant = false;

const assignmentRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"]);

export default async function CustomersPage() {
  const user = await requireRole(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER", "PROPERTY_AGENT"]);
  const canAssign = assignmentRoles.has(user.role);
  const [customers, agents] = await Promise.all([
    prisma.customer.findMany({
      where: canAssign ? {} : { assignedAgentId: user.userId },
      orderBy: { updatedAt: "desc" },
      include: { assignedAgent: true },
    }),
    canAssign
      ? prisma.user.findMany({
          where: { role: "PROPERTY_AGENT" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Relationships</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Customers</h2>
        <p className="mt-2 text-sm text-slate-600">Keep customer requirements and ownership in one place.</p>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer font-semibold text-slate-900">Add customer</summary>
        <form action={createCustomerAction} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-slate-600">Full name<input name="fullName" required minLength={2} maxLength={120} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
          <label className="text-sm text-slate-600">Phone<input name="phone" type="tel" required minLength={7} maxLength={32} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
          <label className="text-sm text-slate-600">WhatsApp<input name="whatsapp" type="tel" maxLength={32} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
          <label className="text-sm text-slate-600">Email<input name="email" type="email" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
          <label className="text-sm text-slate-600">City<input name="city" maxLength={100} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
          <label className="text-sm text-slate-600">Budget (PKR)<input name="budget" type="number" min="0" step="1" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
          <label className="text-sm text-slate-600">Preferred locations<input name="preferredLocations" maxLength={500} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
          <label className="text-sm text-slate-600">Property preferences<input name="propertyPreferences" maxLength={500} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
          <label className="text-sm text-slate-600 xl:col-span-2">Investment objective<input name="investmentObjective" maxLength={500} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
          {canAssign ? (
            <label className="text-sm text-slate-600">Assigned agent<select name="assignedAgentId" defaultValue="" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value="">Unassigned</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>
          ) : null}
          <label className="text-sm text-slate-600 xl:col-span-3">Notes<textarea name="notes" maxLength={2000} rows={2} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
          <div className="self-end"><button type="submit" className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Save customer</button></div>
        </form>
      </details>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-3 pr-4">Customer</th>
              <th className="py-3 pr-4">Contact</th>
              <th className="py-3 pr-4">City</th>
              <th className="py-3 pr-4">Budget</th>
              <th className="py-3 pr-4">Preferences</th>
              <th className="py-3 pr-4">Agent</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-b border-slate-100 last:border-0">
                <td className="py-3 pr-4 font-medium text-slate-900"><Link className="hover:underline" href={`/dashboard/customers/${customer.id}`}>{customer.fullName}</Link></td>
                <td className="py-3 pr-4 text-slate-600">{customer.phone}<br />{customer.email ?? ""}</td>
                <td className="py-3 pr-4 text-slate-600">{customer.city ?? "—"}</td>
                <td className="py-3 pr-4 text-slate-700">{customer.budget ? `PKR ${customer.budget.toLocaleString("en-PK")}` : "Not set"}</td>
                <td className="py-3 pr-4 text-slate-600">{customer.propertyPreferences ?? customer.preferredLocations ?? "—"}</td>
                <td className="py-3 pr-4 text-slate-600">{customer.assignedAgent?.name ?? "Unassigned"}</td>
              </tr>
            ))}
            {customers.length === 0 ? <tr><td colSpan={6} className="py-10 text-center text-slate-500">No customers yet. Convert a lead or add a customer above.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
