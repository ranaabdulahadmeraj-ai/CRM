import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { createAppointmentAction, updateAppointmentAction } from "@/app/actions";

export const instant = false;

const appointmentStatuses = ["SCHEDULED", "COMPLETED", "CANCELLED", "MISSED"] as const;
const appointmentRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"]);

export default async function AppointmentsPage() {
  const user = await requireRole(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER", "PROPERTY_AGENT"]);
  const canAssign = appointmentRoles.has(user.role);
  const scope = canAssign ? {} : { assignedAgentId: user.userId };
  const [appointments, leads, customers, agents] = await Promise.all([
    prisma.appointment.findMany({
      where: canAssign ? {} : { agentId: user.userId },
      orderBy: { appointmentDate: "asc" },
      include: { customer: true, lead: true, agent: true },
    }),
    prisma.lead.findMany({
      where: scope,
      orderBy: { createdAt: "desc" },
      select: { id: true, fullName: true, phone: true, customerId: true },
    }),
    prisma.customer.findMany({
      where: scope,
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, phone: true },
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Scheduling and follow-up</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Appointments</h2>
          <p className="mt-2 text-sm text-slate-600">Schedule calls, meetings and property visits; record the outcome when complete.</p>
        </div>
        <span className="rounded-full bg-pink-100 px-3 py-1.5 text-sm font-medium text-pink-700">{appointments.length} appointments</span>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer font-semibold text-slate-900">Schedule an appointment</summary>
        <form action={createAppointmentAction} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm text-slate-600">
            Appointment title
            <input name="title" required minLength={2} maxLength={160} placeholder="e.g. Site visit — DHA Phase 6" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
          <label className="text-sm text-slate-600">
            Type
            <select name="type" required defaultValue="CALL" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900">
              <option value="CALL">Customer call</option>
              <option value="MEETING">Meeting</option>
              <option value="PROPERTY_VISIT">Property visit</option>
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Date and time
            <input name="appointmentDate" type="datetime-local" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
          <label className="text-sm text-slate-600">
            Lead
            <select name="leadId" defaultValue="" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900">
              <option value="">No lead selected</option>
              {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.fullName} · {lead.phone}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Customer
            <select name="customerId" defaultValue="" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900">
              <option value="">No customer selected</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.fullName} · {customer.phone}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Location
            <input name="location" maxLength={200} placeholder="Office, property or call link" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
          {canAssign ? (
            <label className="text-sm text-slate-600">
              Assign to agent
              <select name="agentId" defaultValue="" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900">
                <option value="">Unassigned</option>
                {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </select>
            </label>
          ) : null}
          <div className="self-end">
            <button type="submit" className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Save appointment</button>
          </div>
        </form>
      </details>

      <div className="space-y-3">
        {appointments.map((appointment) => (
          <article key={appointment.id} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-900">{appointment.title}</h3>
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">{appointment.status}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {appointment.type.replaceAll("_", " ")} · {appointment.customer?.fullName ?? appointment.lead?.fullName ?? "Contact not selected"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(appointment.appointmentDate).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })} · {appointment.location ?? "Location not set"} · {appointment.agent?.name ?? "Unassigned"}
              </p>
            </div>
            <form action={updateAppointmentAction} className="grid gap-2 sm:grid-cols-[auto_1fr_auto] md:min-w-[460px]">
              <input type="hidden" name="appointmentId" value={appointment.id} />
              <label className="sr-only" htmlFor={`appointment-status-${appointment.id}`}>Appointment status</label>
              <select id={`appointment-status-${appointment.id}`} name="status" defaultValue={appointment.status} className="rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-700">
                {appointmentStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
              </select>
              <label className="sr-only" htmlFor={`appointment-notes-${appointment.id}`}>Appointment outcome notes</label>
              <input id={`appointment-notes-${appointment.id}`} name="notes" defaultValue={appointment.notes ?? ""} maxLength={2000} placeholder="Outcome or follow-up notes" className="min-w-0 rounded-md border border-slate-300 px-2 py-2 text-xs text-slate-700" />
              <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">Update</button>
            </form>
          </article>
        ))}
        {appointments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <h3 className="font-semibold text-slate-900">No appointments yet</h3>
            <p className="mt-2 text-sm text-slate-600">Schedule the next customer call or property visit to start your calendar.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
