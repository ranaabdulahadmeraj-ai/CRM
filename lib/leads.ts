import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const websiteInquirySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(32),
  whatsapp: z.string().trim().max(32).optional().or(z.literal("")),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  project: z.string().trim().max(160).optional().or(z.literal("")),
  projectId: z.string().trim().max(30).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  budget: z.coerce.number().finite().min(0).max(1_000_000_000_000).optional().default(0),
  propertySize: z.string().trim().max(100).optional().or(z.literal("")),
  investmentGoal: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

export function normalizePakistaniPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = `92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("3")) digits = `92${digits}`;
  if (digits.length < 7 || digits.length > 15) return null;
  return `+${digits}`;
}

export async function createWebsiteInquiry(input: unknown) {
  const parsed = websiteInquirySchema.safeParse(input);
  if (!parsed.success) {
    return { kind: "invalid" as const, issues: parsed.error.issues };
  }

  const payload = parsed.data;
  const normalizedPhone = normalizePakistaniPhone(payload.phone);
  const normalizedWhatsapp = payload.whatsapp ? normalizePakistaniPhone(payload.whatsapp) : null;
  if (!normalizedPhone || (payload.whatsapp && !normalizedWhatsapp)) {
    return { kind: "invalid" as const, issues: [{ message: "Enter a valid phone or WhatsApp number." }] };
  }
  const email = payload.email?.trim().toLowerCase() || null;

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const duplicate = await transaction.lead.findFirst({
        where: {
          OR: [
            { normalizedPhone },
            { phone: normalizedPhone },
            ...(email ? [{ normalizedEmail: email }, { email }] : []),
          ],
        },
        select: { id: true },
      });
      if (duplicate) return { kind: "duplicate" as const, leadId: duplicate.id };

      const [legacyLeads, legacyCustomers] = await Promise.all([
        transaction.lead.findMany({
          where: { normalizedPhone: null },
          select: { id: true, phone: true, email: true },
        }),
        transaction.customer.findMany({
          where: { normalizedPhone: null },
          select: { id: true, phone: true, email: true, whatsapp: true, fullName: true, city: true, budget: true, assignedAgentId: true },
        }),
      ]);
      const legacyDuplicate = legacyLeads.find((lead) =>
        normalizePakistaniPhone(lead.phone) === normalizedPhone ||
        (!!email && lead.email?.trim().toLowerCase() === email)
      );
      if (legacyDuplicate) return { kind: "duplicate" as const, leadId: legacyDuplicate.id };

      const customer = await transaction.customer.findFirst({
        where: {
          OR: [
            { normalizedPhone },
            ...(email ? [{ normalizedEmail: email }] : []),
          ],
        },
      });
      const legacyCustomer = customer ?? legacyCustomers.find((item) =>
        normalizePakistaniPhone(item.phone) === normalizedPhone ||
        (!!email && item.email?.trim().toLowerCase() === email)
      ) ?? null;

      const projectId = payload.projectId
        ? (await transaction.project.findUnique({ where: { id: payload.projectId }, select: { id: true } }))?.id ?? null
        : payload.project
          ? (await transaction.project.findFirst({
              where: { name: payload.project },
              select: { id: true },
            }))?.id ?? null
          : null;
      const projectNote = payload.project && !projectId
        ? `Interested in ${payload.project}`
        : null;

      const eligibleAgents = await transaction.user.findMany({
        where: { role: { in: ["PROPERTY_AGENT", "MANAGER", "AGENCY_ADMIN", "SUPER_ADMIN"] } },
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, _count: { select: { assignedLeads: true } } },
      });
      eligibleAgents.sort((left, right) => {
        const roleOrder = (role: string) => role === "PROPERTY_AGENT" ? 0 : 1;
        return roleOrder(left.role) - roleOrder(right.role) ||
          left._count.assignedLeads - right._count.assignedLeads;
      });
      const assignedAgentId = customer?.assignedAgentId ?? legacyCustomer?.assignedAgentId ?? eligibleAgents[0]?.id ?? null;

      const customerId = legacyCustomer
        ? legacyCustomer.id
        : (await transaction.customer.create({
            data: {
              fullName: payload.fullName,
              phone: normalizedPhone,
              normalizedPhone,
              normalizedEmail: email,
              whatsapp: normalizedWhatsapp,
              email,
              city: payload.city || null,
              budget: payload.budget || null,
              propertyPreferences: payload.propertySize || null,
              investmentObjective: payload.investmentGoal || null,
              assignedAgentId,
            },
            select: { id: true },
          })).id;

      if (legacyCustomer) {
        await transaction.customer.update({
          where: { id: legacyCustomer.id },
          data: {
            normalizedPhone: legacyCustomer.phone ? normalizePakistaniPhone(legacyCustomer.phone) : normalizedPhone,
            normalizedEmail: legacyCustomer.email?.trim().toLowerCase() || email,
            whatsapp: legacyCustomer.whatsapp || normalizedWhatsapp,
            city: legacyCustomer.city || payload.city || null,
            budget: legacyCustomer.budget ?? (payload.budget || null),
            assignedAgentId: legacyCustomer.assignedAgentId ?? assignedAgentId,
          },
        });
      }

      const lead = await transaction.lead.create({
        data: {
          fullName: payload.fullName,
          phone: normalizedPhone,
          normalizedPhone,
          normalizedEmail: email,
          whatsapp: normalizedWhatsapp,
          email,
          selectedProjectId: projectId,
          city: payload.city || null,
          budget: payload.budget || null,
          propertySize: payload.propertySize || null,
          investmentGoal: payload.investmentGoal || null,
          message: payload.message || null,
          source: "WEBSITE",
          status: "NEW_INQUIRY",
          priority: payload.budget >= 15_000_000 ? "Hot" : "Medium",
          notes: projectNote,
          assignedAgentId,
          customerId,
        },
        select: { id: true },
      });

      await transaction.auditLog.create({
        data: {
          action: "website.inquiry.created",
          entity: "Lead",
          entityId: lead.id,
          details: "Website inquiry captured and linked to customer profile.",
        },
      });

      if (assignedAgentId) {
        await transaction.reminder.create({
          data: {
            title: "Website inquiry follow-up",
            description: `Contact new inquiry ${lead.id}.`,
            dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
            assignedToId: assignedAgentId,
            createdById: null,
            customerId,
            leadId: lead.id,
          },
        });
      }

      return { kind: "created" as const, leadId: lead.id, customerId };
    }, { timeout: 15_000 });

    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { kind: "duplicate" as const, leadId: null };
    }
    throw error;
  }
}
