import { createDealAction, recordDealPaymentAction, updateDealStatusAction } from "@/app/actions";
import { recordCommissionPaymentAction } from "@/app/finance-actions";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const instant = false;

const dealManagementRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER", "PROPERTY_AGENT"]);
const financeRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "ACCOUNTANT"]);
const dealStatuses = ["NEGOTIATION", "BOOKING", "DOCUMENTATION", "AGREEMENT_SIGNED", "PAYMENT_PENDING", "COMPLETED", "CANCELLED"] as const;

export default async function DealsPage() {
  const user = await requireRole(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER", "PROPERTY_AGENT", "ACCOUNTANT"]);
  const canManage = dealManagementRoles.has(user.role);
  const canRecordPayments = financeRoles.has(user.role);
  const [deals, properties, customers, agents] = await Promise.all([
    prisma.deal.findMany({
      where: user.role === "PROPERTY_AGENT" ? { agentId: user.userId } : {},
      orderBy: { dealDate: "desc" },
      include: {
        property: true,
        buyer: true,
        agent: true,
        installments: { orderBy: { sequence: "asc" }, include: { payments: true } },
        commissions: { include: { payments: true } },
      },
    }),
    canManage
      ? prisma.property.findMany({
          where: {
            availability: "Available",
            ...(user.role === "PROPERTY_AGENT" ? { assignedAgentId: user.userId } : {}),
          },
          orderBy: { title: "asc" },
          select: { id: true, title: true, price: true },
        })
      : Promise.resolve([]),
    canManage
      ? prisma.customer.findMany({
          where: user.role === "PROPERTY_AGENT" ? { assignedAgentId: user.userId } : {},
          orderBy: { fullName: "asc" },
          select: { id: true, fullName: true, phone: true },
        })
      : Promise.resolve([]),
    ["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"].includes(user.role)
      ? prisma.user.findMany({ where: { role: "PROPERTY_AGENT" }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sales and transactions</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Deals</h2>
          <p className="mt-2 text-sm text-slate-600">Track agreed values, received payments, outstanding balances and commission agreements.</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700">{deals.length} deals</span>
      </div>

      {canManage ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer font-semibold text-slate-900">Create deal</summary>
          <form action={createDealAction} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm text-slate-600">Available property<select name="propertyId" required defaultValue="" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value="">Select a listing</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title} · PKR {property.price.toLocaleString("en-PK")}</option>)}</select></label>
            <label className="text-sm text-slate-600">Buyer<select name="buyerId" required defaultValue="" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value="">Select a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.fullName} · {customer.phone}</option>)}</select></label>
            <label className="text-sm text-slate-600">Agreed deal value (PKR)<input name="dealValue" type="number" min="1" step="1" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">Booking received (PKR)<input name="bookingAmount" type="number" min="0" step="1" defaultValue="0" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">Advance received (PKR)<input name="advancePayment" type="number" min="0" step="1" defaultValue="0" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">Commission agreement (%)<input name="commissionRate" type="number" min="0" max="100" step="0.01" defaultValue="0" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">Agency share of commission (%)<input name="agencyShareRate" type="number" min="0" max="100" step="1" defaultValue="60" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">Number of monthly installments<input name="installmentCount" type="number" min="1" max="120" step="1" defaultValue="12" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">First installment due (optional)<input name="firstInstallmentDate" type="date" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">Expected closing date<input name="expectedClosingDate" type="date" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            {agents.length ? <label className="text-sm text-slate-600">Assigned agent<select name="agentId" defaultValue="" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value="">Unassigned</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label> : null}
            <div className="self-end"><button type="submit" disabled={!properties.length || !customers.length} className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">Create deal</button></div>
          </form>
          {!properties.length || !customers.length ? <p className="mt-3 text-sm text-amber-700">Add an available property and customer before creating a deal.</p> : null}
        </details>
      ) : null}

      <div className="space-y-4">
        {deals.map((deal) => (
          <article key={deal.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-700">{deal.dealId}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">{deal.property?.title ?? "Property not set"}</h3>
                <p className="mt-1 text-sm text-slate-600">Buyer: {deal.buyer?.fullName ?? "Not set"} · Agent: {deal.agent?.name ?? "Unassigned"}</p>
              </div>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">{deal.status.replaceAll("_", " ")}</span>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["Deal value", deal.dealValue],
                ["Booking", deal.bookingAmount ?? 0],
                ["Received", deal.advancePayment ?? 0],
                ["Outstanding", deal.remainingBalance ?? 0],
                ["Commission", deal.commissionAmount ?? 0],
              ].map(([label, amount]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">{label}</dt>
                  <dd className="mt-1 font-semibold text-slate-900">PKR {Number(amount).toLocaleString("en-PK")}</dd>
                </div>
              ))}
            </dl>
            {deal.installments.length ? (
              <details className="mt-4 rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-800">Payment schedule · {deal.installments.length} installments</summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {deal.installments.map((installment) => {
                    const overdue = installment.status !== "PAID" && installment.dueDate < new Date();
                    return <div key={installment.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="font-medium text-slate-900">{installment.title} · {overdue ? "OVERDUE" : installment.status}</p>
                      <p className="mt-1 text-slate-600">Due {installment.dueDate.toLocaleDateString()} · PKR {installment.amount.toLocaleString("en-PK")}</p>
                      <p className="text-slate-600">Paid PKR {installment.amountPaid.toLocaleString("en-PK")} · Remaining PKR {Math.max(installment.amount - installment.amountPaid, 0).toLocaleString("en-PK")}</p>
                    </div>;
                  })}
                </div>
              </details>
            ) : null}
            {deal.commissions.map((commission) => {
              const agencyPaid = commission.payments.reduce((sum, payment) => sum + payment.agencyAmount, 0);
              const agentPaid = commission.payments.reduce((sum, payment) => sum + payment.agentAmount, 0);
              const agencyDue = Math.max(commission.agencyShare - agencyPaid, 0);
              const agentDue = Math.max(commission.agentShare - agentPaid, 0);
              return <div key={commission.id} className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-slate-900">Commission agreement · {commission.status}</p><p className="text-sm text-slate-700">Agency {commission.agencyShareRate}%: PKR {agencyPaid.toLocaleString("en-PK")} / {commission.agencyShare.toLocaleString("en-PK")} · Agent {commission.agentShareRate}%: PKR {agentPaid.toLocaleString("en-PK")} / {commission.agentShare.toLocaleString("en-PK")}</p></div>
                {canRecordPayments && (agencyDue > 0 || agentDue > 0) ? <form action={recordCommissionPaymentAction} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="commissionId" value={commission.id} />
                  <label className="text-xs text-slate-600">Agency receipt<input name="agencyAmount" type="number" min="0" max={agencyDue} step="1" defaultValue="0" className="mt-1 block w-36 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800" /></label>
                  <label className="text-xs text-slate-600">Agent payout<input name="agentAmount" type="number" min="0" max={agentDue} step="1" defaultValue="0" className="mt-1 block w-36 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800" /></label>
                  <label className="text-xs text-slate-600">Reference<input name="reference" maxLength={120} className="mt-1 block w-40 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800" /></label>
                  <button type="submit" className="rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">Record commission payment</button>
                </form> : null}
              </div>;
            })}
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-4">
              {canManage ? (
                <form action={updateDealStatusAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="dealId" value={deal.dealId} />
                  <label className="text-xs text-slate-500">Update deal status<select name="status" defaultValue={deal.status} className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800">{dealStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label>
                  <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Save</button>
                </form>
              ) : null}
              {canRecordPayments && deal.status !== "COMPLETED" && deal.status !== "CANCELLED" && (deal.remainingBalance ?? 0) > 0 ? (
                <form action={recordDealPaymentAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="dealId" value={deal.dealId} />
                  <label className="text-xs text-slate-500">Record payment (allocated by due date)<input name="amount" type="number" min="1" max={deal.remainingBalance ?? 0} step="1" required placeholder="PKR" className="mt-1 block w-32 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800" /></label>
                  <label className="text-xs text-slate-500">Description<input name="description" maxLength={300} placeholder="Installment, transfer…" className="mt-1 block w-48 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800" /></label>
                  <button type="submit" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Record receipt</button>
                </form>
              ) : null}
            </div>
          </article>
        ))}
        {deals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h3 className="font-semibold text-slate-900">No deals yet</h3>
            <p className="mt-2 text-sm text-slate-600">Deals will appear here after a customer selects an available property.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
