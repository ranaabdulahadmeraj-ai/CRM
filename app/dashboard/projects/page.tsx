import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { createProjectAction } from "@/app/actions";

export const instant = false;

export default async function ProjectsPage() {
  const user = await requireRole(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER", "PROPERTY_AGENT"]);
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: { properties: true },
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Portfolio</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Projects</h2>
        </div>
        <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">{projects.length} projects</span>
      </div>

      {["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"].includes(user.role) ? (
        <details className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer font-semibold text-slate-900">Add project</summary>
          <form action={createProjectAction} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm text-slate-600">Project name<input name="name" required maxLength={160} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">Developer<input name="developerName" required maxLength={160} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">City<input name="city" required maxLength={100} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">Location<input name="location" required maxLength={200} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600">Status<select name="status" defaultValue="Active" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"><option>Active</option><option>Coming Soon</option><option>Archived</option></select></label>
            <label className="text-sm text-slate-600">Image URL (optional)<input name="image" type="url" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600 sm:col-span-2 xl:col-span-3">Description<textarea name="description" required minLength={10} maxLength={3000} rows={3} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
            <label className="text-sm text-slate-600 sm:col-span-2 xl:col-span-3">Verified payment plan (optional)<textarea name="paymentPlans" maxLength={3000} rows={2} placeholder="Enter only terms confirmed by the developer." className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900" /></label>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input name="featured" type="checkbox" className="h-4 w-4 rounded border-slate-300" />Show on public website</label>
            <div><button type="submit" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Save project</button></div>
          </form>
        </details>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-3 pr-4">Project</th>
              <th className="py-3 pr-4">City</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Properties</th>
              <th className="py-3 pr-4">Featured</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-b border-slate-200 last:border-b-0">
                <td className="py-3 pr-4 font-medium text-slate-800">{project.name}</td>
                <td className="py-3 pr-4 text-slate-600">{project.city}</td>
                <td className="py-3 pr-4">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">{project.status}</span>
                </td>
                <td className="py-3 pr-4 text-slate-600">{project.properties.length}</td>
                <td className="py-3 pr-4 text-slate-600">{project.featured ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
