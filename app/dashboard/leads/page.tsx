import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { convertLeadAction, createLeadAction, updateLeadAction } from "@/app/actions";

export const instant = false;

const leadStages = [
  ["NEW_INQUIRY", "New inquiry"],
  ["CONTACTED", "Contacted"],
  ["INTERESTED", "Interested"],
  ["QUALIFIED", "Qualified"],
  ["SITE_VISIT_SCHEDULED", "Site visit"],
  ["NEGOTIATION", "Negotiation"],
  ["CONVERTED", "Converted"],
  ["LOST", "Lost"],
] as const;

const leadPriorities = ["Low", "Medium", "Hot"] as const;
const leadSources = [
  ["WALK_IN", "Walk-in"],
  ["PHONE_CALL", "Phone call"],
  ["WHATSAPP", "WhatsApp"],
  ["REFERRAL", "Referral"],
  ["FACEBOOK", "Facebook"],
  ["INSTAGRAM", "Instagram"],
  ["GOOGLE", "Google"],
] as const;
const assignableRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"]);

export default async function LeadsPage() {
  const user = await requireRole(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER", "PROPERTY_AGENT"]);
  const canAssign = assignableRoles.has(user.role);
  const [leads, agents] = await Promise.all([
    prisma.lead.findMany({
      where: canAssign ? {} : { assignedAgentId: user.userId },
      orderBy: { createdAt: "desc" },
      include: { assignedAgent: true, selectedProject: true },
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
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Customer relationship management</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Lead pipeline</h2>
          <p className="mt-2 text-sm text-slate-600">Capture inquiries, assign ownership and move prospects through the sales journey.</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700">{leads.length} leads</span>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer font-semibold text-slate-900">Add a lead</summary>
        <form action={createLeadAction} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-slate-600">
            Full name
            <input name="fullName" required minLength={2} maxLength={120} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
          <label className="text-sm text-slate-600">
            Phone
            <input name="phone" required minLength={7} maxLength={32} type="tel" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
          <label className="text-sm text-slate-600">
            WhatsApp
            <input name="whatsapp" maxLength={32} type="tel" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
          <label className="text-sm text-slate-600">
            Email
            <input name="email" type="email" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
          <label className="text-sm text-slate-600">
            Preferred city
            <input name="city" maxLength={100} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
          <label className="text-sm text-slate-600">
            Budget (PKR)
            <input name="budget" type="number" min="0" step="1" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
          <label className="text-sm text-slate-600">
            Property size
            <input name="propertySize" maxLength={100} placeholder="e.g. 10 Marla" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
          <label className="text-sm text-slate-600">
            Lead source
            <select name="source" required defaultValue="WALK_IN" className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900">
              {leadSources.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-600 sm:col-span-2 xl:col-span-4">
            Investment goal or inquiry notes
            <textarea name="message" rows={2} maxLength={2000} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </label>
          <div className="sm:col-span-2 xl:col-span-4">
            <button type="submit" className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Create lead</button>
          </div>
        </form>
      </details>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[1680px] grid-cols-8 gap-4">
          {leadStages.map(([stage, label]) => {
            const stageLeads = leads.filter((lead) => lead.status === stage);
            return (
              <section key={stage} className="min-h-72 rounded-2xl bg-slate-100 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{stageLeads.length}</span>
                </div>
                <div className="space-y-3">
                  {stageLeads.map((lead) => (
                    <article key={lead.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-semibold text-slate-900">{lead.fullName}</h4>
                          <p className="mt-1 text-xs text-slate-500">{lead.source.replaceAll("_", " ")} · {lead.city ?? "City not set"}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${lead.priority === "Hot" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                          {lead.priority}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-slate-600">
                        <a className="block hover:text-sky-700" href={`tel:${lead.phone}`}>{lead.phone}</a>
                        {lead.email ? <p className="truncate">{lead.email}</p> : null}
                        {lead.budget ? <p>PKR {lead.budget.toLocaleString("en-PK")}</p> : null}
                        {lead.selectedProject ? <p className="truncate">{lead.selectedProject.name}</p> : null}
                        <p>{lead.assignedAgent?.name ?? "Unassigned"}</p>
                      </div>
                      <form action={updateLeadAction} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        <input type="hidden" name="leadId" value={lead.id} />
                        <label className="sr-only" htmlFor={`stage-${lead.id}`}>Lead stage</label>
                        <select id={`stage-${lead.id}`} name="status" defaultValue={lead.status} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700">
                          {leadStages.filter(([value]) => value !== "CONVERTED" || lead.status === "CONVERTED").map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                        </select>
                        <label className="sr-only" htmlFor={`priority-${lead.id}`}>Lead priority</label>
                        <select id={`priority-${lead.id}`} name="priority" defaultValue={lead.priority} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700">
                          {leadPriorities.map((priority) => <option key={priority} value={priority}>{priority} priority</option>)}
                        </select>
                        {canAssign ? (
                          <>
                            <label className="sr-only" htmlFor={`agent-${lead.id}`}>Assigned agent</label>
                            <select id={`agent-${lead.id}`} name="assignedAgentId" defaultValue={lead.assignedAgentId ?? ""} className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700">
                              <option value="">Unassigned</option>
                              {lead.assignedAgent && !agents.some((agent) => agent.id === lead.assignedAgentId) ? <option value={lead.assignedAgentId ?? ""}>{lead.assignedAgent.name} (current assignment)</option> : null}
                              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                            </select>
                          </>
                        ) : null}
                        <label className="sr-only" htmlFor={`notes-${lead.id}`}>Lead notes</label>
                        <textarea id={`notes-${lead.id}`} name="notes" rows={2} maxLength={2000} defaultValue={lead.notes ?? ""} placeholder="Add a note…" className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-700" />
                        <button type="submit" className="w-full rounded-md bg-slate-900 px-2 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">Save updates</button>
                      </form>
                      {lead.status !== "CONVERTED" && lead.status !== "LOST" ? (
                        <form action={convertLeadAction} className="mt-2">
                          <input type="hidden" name="leadId" value={lead.id} />
                          <button type="submit" className="w-full rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">Convert to customer</button>
                        </form>
                      ) : null}
                    </article>
                  ))}
                  {stageLeads.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 px-3 py-5 text-center text-xs text-slate-500">No leads in this stage</p> : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
