import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { createPropertyAction, updatePropertyStatusAction } from "@/app/actions";

export const instant = false;

export default async function PropertiesPage() {
  const user = await requireRole(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER", "PROPERTY_AGENT"]);
  const canAssign = ["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"].includes(user.role);
  const [properties, projects, agents] = await Promise.all([
    prisma.property.findMany({
      where: canAssign ? {} : { assignedAgentId: user.userId },
      orderBy: { createdAt: "desc" },
      include: { project: true, assignedAgent: true },
    }),
    prisma.project.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    canAssign
      ? prisma.user.findMany({ where: { role: "PROPERTY_AGENT" }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Inventory</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Properties</h2>
        </div>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-medium text-violet-700">{properties.length} listings</span>
      </div>

      <details className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer font-semibold text-slate-900">Add property listing</summary>
        <form action={createPropertyAction} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm text-slate-600">Title<input name="title" required maxLength={200} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
          <label className="text-sm text-slate-600">Project<select name="projectId" defaultValue="" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value="">Direct listing</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label className="text-sm text-slate-600">Property type<select name="propertyType" defaultValue="Residential plots" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900">{["Residential plots", "Commercial plots", "Houses", "Apartments", "Shops", "Offices", "Files", "Farmhouses", "Investment properties"].map((type) => <option key={type}>{type}</option>)}</select></label>
          <label className="text-sm text-slate-600">Size<input name="size" required maxLength={100} placeholder="e.g. 10 Marla" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
          <label className="text-sm text-slate-600">Location<input name="location" required maxLength={200} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
          <label className="text-sm text-slate-600">Price (PKR)<input name="price" type="number" min="1" step="1" required className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
          <label className="text-sm text-slate-600">Owner<input name="owner" maxLength={160} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
          {canAssign ? <label className="text-sm text-slate-600">Assigned agent<select name="assignedAgentId" defaultValue="" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"><option value="">Unassigned</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label> : null}
          <label className="text-sm text-slate-600 xl:col-span-2">Image URL (optional)<input name="image" type="url" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
          <label className="text-sm text-slate-600 xl:col-span-2">Description<textarea name="description" maxLength={3000} rows={2} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
          <div className="self-end"><button type="submit" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Save listing</button></div>
        </form>
      </details>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-3 pr-4">Title</th>
              <th className="py-3 pr-4">Project</th>
              <th className="py-3 pr-4">Type</th>
              <th className="py-3 pr-4">Price</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Agent</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((property) => (
              <tr key={property.id} className="border-b border-slate-200 last:border-b-0">
                <td className="py-3 pr-4 font-medium text-slate-800">{property.title}</td>
                <td className="py-3 pr-4 text-slate-600">{property.project?.name ?? "Direct listing"}</td>
                <td className="py-3 pr-4 text-slate-600">{property.propertyType}</td>
                <td className="py-3 pr-4 text-slate-700">PKR {property.price.toLocaleString("en-PK")}</td>
                <td className="py-3 pr-4">
                  <form action={updatePropertyStatusAction}>
                    <input type="hidden" name="propertyId" value={property.id} />
                    <label className="sr-only" htmlFor={`property-status-${property.id}`}>Availability for {property.title}</label>
                    <select id={`property-status-${property.id}`} name="availability" defaultValue={property.availability} className="rounded-full border-0 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                      {["Available", "Reserved", "Sold", "Rented", "Under Negotiation", "Archived"].map((status) => <option key={status}>{status}</option>)}
                    </select>
                    <button type="submit" className="ml-2 text-xs font-semibold text-sky-700 hover:text-sky-900">Save</button>
                  </form>
                </td>
                <td className="py-3 pr-4 text-slate-600">{property.assignedAgent?.name ?? "Unassigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
