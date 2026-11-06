import { logInteractionAction, createReminderAction } from "@/app/reminder-actions";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

export const instant = false;

const managerRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"]);
const interactionTypes = ["CALL", "PROPERTY_VISIT", "WHATSAPP", "EMAIL", "MEETING", "NOTE"] as const;

export default async function CustomerProfilePage({ params }: { params: Promise<{ customerId: string }> }) {
  const user = await requireRole(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER", "PROPERTY_AGENT"]);
  const { customerId } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, ...(managerRoles.has(user.role) ? {} : { assignedAgentId: user.userId }) },
    include: {
      assignedAgent: { select: { name: true } },
      leads: { orderBy: { createdAt: "desc" }, include: { selectedProject: { select: { name: true } } } },
      appointments: { orderBy: { appointmentDate: "desc" }, include: { agent: { select: { name: true } } } },
      interactions: { orderBy: { occurredAt: "desc" }, include: { agent: { select: { name: true } } } },
      reminders: { orderBy: { dueAt: "asc" }, include: { assignedTo: { select: { name: true } } } },
      buyerDeals: { orderBy: { dealDate: "desc" }, include: { property: { select: { title: true } }, installments: { orderBy: { sequence: "asc" }, include: { payments: true } }, commissions: { include: { payments: true } } } },
      sellerDeals: { orderBy: { dealDate: "desc" }, include: { property: { select: { title: true } } } },
    },
  });
  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <header>
        <Link href="/dashboard/customers" className="text-sm font-medium text-sky-700 hover:underline">← Customers</Link>
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">Customer profile</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">{customer.fullName}</h2>
        <p className="mt-2 text-sm text-slate-600">{customer.phone} · {customer.email ?? "No email"} · {customer.assignedAgent?.name ?? "Unassigned agent"}</p>
        <p className="mt-1 text-sm text-slate-600">{customer.city ?? "City not set"} · Budget {customer.budget ? `PKR ${customer.budget.toLocaleString("en-PK")}` : "not set"} · {customer.propertyPreferences ?? customer.preferredLocations ?? "No preferences recorded"}</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-2">
        <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer font-semibold text-slate-900">Log call, visit, or interaction</summary>
          <form action={logInteractionAction} className="mt-5 space-y-3">
            <input type="hidden" name="customerId" value={customer.id} />
            <label className="block text-sm text-slate-600">Type<select name="type" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900">{interactionTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label>
            <label className="block text-sm text-slate-600">Summary<input name="summary" required minLength={2} maxLength={200} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="block text-sm text-slate-600">Details<textarea name="details" maxLength={2000} rows={2} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="block text-sm text-slate-600">Schedule follow-up<input name="followUpAt" type="datetime-local" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Save interaction</button>
          </form>
        </details>
        <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer font-semibold text-slate-900">Create customer reminder</summary>
          <form action={createReminderAction} className="mt-5 space-y-3">
            <input type="hidden" name="customerId" value={customer.id} />
            <label className="block text-sm text-slate-600">Title<input name="title" required minLength={2} maxLength={160} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="block text-sm text-slate-600">Due date and time<input name="dueAt" type="datetime-local" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <label className="block text-sm text-slate-600">Details<textarea name="description" maxLength={1000} rows={2} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
            <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Save reminder</button>
          </form>
        </details>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["Leads", customer.leads.length], ["Interactions", customer.interactions.length], ["Appointments", customer.appointments.length], ["Deals", customer.buyerDeals.length + customer.sellerDeals.length]].map(([label, count]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold text-slate-900">{count}</p></div>)}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Communication history</h3>
          <div className="mt-4 space-y-3">{customer.interactions.map((interaction) => <article key={interaction.id} className="rounded-xl bg-slate-50 p-3"><p className="font-medium text-slate-900">{interaction.type.replaceAll("_", " ")} · {interaction.summary}</p><p className="mt-1 text-sm text-slate-600">{interaction.details ?? "No additional details."}</p><p className="mt-1 text-xs text-slate-500">{interaction.occurredAt.toLocaleString()} · {interaction.agent.name}</p></article>)}{customer.interactions.length === 0 ? <p className="py-5 text-sm text-slate-500">No interactions logged.</p> : null}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Appointments and reminders</h3>
          <div className="mt-4 space-y-3">{customer.appointments.map((appointment) => <article key={appointment.id} className="rounded-xl bg-slate-50 p-3"><p className="font-medium text-slate-900">{appointment.title} · {appointment.status}</p><p className="mt-1 text-sm text-slate-600">{appointment.type.replaceAll("_", " ")} · {appointment.appointmentDate.toLocaleString()} · {appointment.agent?.name ?? "No assigned agent"}</p></article>)}{customer.reminders.map((reminder) => <article key={reminder.id} className="rounded-xl bg-amber-50 p-3"><p className="font-medium text-slate-900">{reminder.title} · {reminder.status}</p><p className="mt-1 text-sm text-slate-600">Due {reminder.dueAt.toLocaleString()} · {reminder.assignedTo.name}</p></article>)}</div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Lead and transaction history</h3>
        <div className="mt-4 space-y-3">
          {customer.leads.map((lead) => <article key={lead.id} className="rounded-xl border border-slate-100 p-3"><p className="font-medium text-slate-900">Lead · {lead.status.replaceAll("_", " ")}</p><p className="mt-1 text-sm text-slate-600">{lead.source} · {lead.city ?? "No city"} · {lead.selectedProject?.name ?? "No project"} · {lead.createdAt.toLocaleDateString()}</p></article>)}
          {customer.buyerDeals.map((deal) => <article key={deal.id} className="rounded-xl border border-slate-100 p-3"><p className="font-medium text-slate-900">Buyer deal {deal.dealId} · {deal.status}</p><p className="mt-1 text-sm text-slate-600">{deal.property?.title ?? "Property not set"} · Value PKR {deal.dealValue.toLocaleString("en-PK")} · Outstanding PKR {(deal.remainingBalance ?? 0).toLocaleString("en-PK")}</p><p className="mt-1 text-xs text-slate-500">{deal.installments.length} installments · {deal.commissions.length} commission agreements</p></article>)}
          {customer.sellerDeals.map((deal) => <article key={deal.id} className="rounded-xl border border-slate-100 p-3"><p className="font-medium text-slate-900">Seller deal {deal.dealId} · {deal.status}</p><p className="mt-1 text-sm text-slate-600">{deal.property?.title ?? "Property not set"} · Value PKR {deal.dealValue.toLocaleString("en-PK")}</p></article>)}
          {customer.leads.length + customer.buyerDeals.length + customer.sellerDeals.length === 0 ? <p className="py-5 text-sm text-slate-500">No lead or transaction history.</p> : null}
        </div>
      </section>
    </div>
  );
}
