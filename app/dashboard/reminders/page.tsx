import { completeReminderAction, createReminderAction, markNotificationReadAction } from "@/app/reminder-actions";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const instant = false;

const assignmentRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"]);

export default async function RemindersPage() {
  const user = await requireRole(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER", "PROPERTY_AGENT"]);
  const canAssign = assignmentRoles.has(user.role);
  const [reminders, notifications, leads, customers, agents] = await Promise.all([
    prisma.reminder.findMany({
      where: canAssign ? {} : { assignedToId: user.userId },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      include: {
        assignedTo: { select: { name: true } },
        lead: { select: { id: true, fullName: true } },
        customer: { select: { id: true, fullName: true } },
      },
    }),
    prisma.notification.findMany({
      where: { userId: user.userId, readAt: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.lead.findMany({
      where: canAssign ? {} : { assignedAgentId: user.userId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.customer.findMany({
      where: canAssign ? {} : { assignedAgentId: user.userId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    canAssign
      ? prisma.user.findMany({ where: { role: "PROPERTY_AGENT" }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  const now = new Date();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Follow-up workflow</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Reminders</h2>
        <p className="mt-2 text-sm text-slate-600">Saved follow-ups remain assigned and available after sign-out. Due alerts are created by the scheduled reminder worker.</p>
      </header>

      <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer font-semibold text-slate-900">Create reminder</summary>
        <form action={createReminderAction} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-slate-600">Title<input name="title" required minLength={2} maxLength={160} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
          <label className="text-sm text-slate-600">Due date and time<input name="dueAt" type="datetime-local" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
          <label className="text-sm text-slate-600">Lead<select name="leadId" defaultValue="" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value="">None</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.fullName}</option>)}</select></label>
          <label className="text-sm text-slate-600">Customer<select name="customerId" defaultValue="" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value="">None</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.fullName}</option>)}</select></label>
          {canAssign ? <label className="text-sm text-slate-600">Assign to<select name="assignedToId" defaultValue="" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value="">Me</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label> : null}
          <label className="text-sm text-slate-600 sm:col-span-2">Details<textarea name="description" maxLength={1000} rows={2} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></label>
          <div className="self-end"><button type="submit" className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">Save reminder</button></div>
        </form>
      </details>

      {notifications.length > 0 ? <section className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-900">Due notifications</h3>
        {notifications.map((notification) => (
          <div key={notification.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div><p className="font-semibold text-slate-900">{notification.title}</p><p className="mt-1 text-sm text-slate-600">{notification.message}</p><p className="mt-1 text-xs text-slate-500">{notification.createdAt.toLocaleString()}</p></div>
            <form action={markNotificationReadAction}><input type="hidden" name="notificationId" value={notification.id} /><button className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-900">Mark read</button></form>
          </div>
        ))}
      </section> : null}

      <section className="space-y-3">
        {reminders.map((reminder) => {
          const isOverdue = reminder.status === "PENDING" && reminder.dueAt < now;
          const contact = reminder.customer ?? reminder.lead;
          return (
            <article key={reminder.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{reminder.title}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isOverdue ? "bg-rose-100 text-rose-700" : reminder.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"}`}>{isOverdue ? "OVERDUE" : reminder.status}</span></div>
                <p className="mt-1 text-sm text-slate-600">{reminder.description ?? "No additional details."}</p>
                <p className="mt-1 text-xs text-slate-500">Due {reminder.dueAt.toLocaleString()} · Assigned to {reminder.assignedTo.name}{contact ? <> · {reminder.customer ? <Link className="underline" href={`/dashboard/customers/${reminder.customer.id}`}>{contact.fullName}</Link> : contact.fullName}</> : null}</p>
              </div>
              {reminder.status === "PENDING" && (!isOverdue || reminder.notifiedAt) ? <form action={completeReminderAction}><input type="hidden" name="reminderId" value={reminder.id} /><button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Complete</button></form> : null}
            </article>
          );
        })}
        {reminders.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">No reminders yet.</p> : null}
      </section>
    </div>
  );
}
