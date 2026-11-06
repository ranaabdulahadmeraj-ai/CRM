"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const managerRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"]);

const pakistanDateTime = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .transform((value) => new Date(`${value}:00+05:00`))
  .refine((value) => !Number.isNaN(value.getTime()), "Enter a valid due date and time.");

const reminderSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional(),
  dueAt: pakistanDateTime,
  leadId: z.string().optional(),
  customerId: z.string().optional(),
  assignedToId: z.string().optional(),
}).refine((reminder) => reminder.leadId || reminder.customerId, {
  message: "Link the reminder to a lead or customer.",
});

const interactionSchema = z.object({
  type: z.enum(["CALL", "PROPERTY_VISIT", "WHATSAPP", "EMAIL", "MEETING", "NOTE"]),
  summary: z.string().trim().min(2).max(200),
  details: z.string().trim().max(2000).optional(),
  leadId: z.string().optional(),
  customerId: z.string().optional(),
  followUpAt: pakistanDateTime.optional(),
}).refine((interaction) => interaction.leadId || interaction.customerId, {
  message: "Link the interaction to a lead or customer.",
});

export async function createReminderAction(formData: FormData) {
  const user = await requireAuth();
  const canAssign = managerRoles.has(user.role);
  if (!canAssign && user.role !== "PROPERTY_AGENT") {
    throw new Error("You are not authorized to create reminders.");
  }
  const parsed = reminderSchema.safeParse({
    title: formData.get("title"),
    description: String(formData.get("description") ?? "").trim(),
    dueAt: formData.get("dueAt"),
    leadId: String(formData.get("leadId") ?? ""),
    customerId: String(formData.get("customerId") ?? ""),
    assignedToId: String(formData.get("assignedToId") ?? ""),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid reminder details.");

  const scope = canAssign ? {} : { assignedAgentId: user.userId };
  const [lead, customer] = await Promise.all([
    parsed.data.leadId
      ? prisma.lead.findFirst({ where: { id: parsed.data.leadId, ...scope }, select: { id: true, customerId: true, assignedAgentId: true } })
      : Promise.resolve(null),
    parsed.data.customerId
      ? prisma.customer.findFirst({ where: { id: parsed.data.customerId, ...scope }, select: { id: true, assignedAgentId: true } })
      : Promise.resolve(null),
  ]);
  if (parsed.data.leadId && !lead) throw new Error("The selected lead does not exist or is not assigned to you.");
  if (parsed.data.customerId && !customer) throw new Error("The selected customer does not exist or is not assigned to you.");
  if (lead && customer && lead.customerId !== customer.id) {
    throw new Error("The selected lead and customer are not linked.");
  }

  let assignedToId = user.userId;
  if (canAssign && parsed.data.assignedToId) {
    const assigned = await prisma.user.findUnique({
      where: { id: parsed.data.assignedToId },
      select: { id: true, role: true },
    });
    if (!assigned || !["PROPERTY_AGENT", "MANAGER"].includes(assigned.role)) {
      throw new Error("Choose an existing agent or manager.");
    }
    assignedToId = assigned.id;
  } else if (user.role === "PROPERTY_AGENT") {
    const owner = lead?.assignedAgentId ?? customer?.assignedAgentId;
    if (owner && owner !== user.userId) throw new Error("You cannot create reminders for another agent's customer.");
  }

  await prisma.reminder.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      dueAt: parsed.data.dueAt,
      assignedToId,
      createdById: user.userId,
      leadId: lead?.id ?? null,
      customerId: customer?.id ?? lead?.customerId ?? null,
    },
  });
  revalidatePath("/dashboard/reminders");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/customers");
}

export async function completeReminderAction(formData: FormData) {
  const user = await requireAuth();
  const reminderId = String(formData.get("reminderId") ?? "").trim();
  if (!reminderId) throw new Error("A reminder must be selected.");

  await prisma.$transaction(async (transaction) => {
    const reminder = await transaction.reminder.findFirst({
      where: {
        id: reminderId,
        ...(managerRoles.has(user.role) ? {} : { assignedToId: user.userId }),
        status: "PENDING",
      },
    });
    if (!reminder) throw new Error("Reminder not found, already completed, or not assigned to you.");

    await transaction.reminder.update({
      where: { id: reminder.id },
      data: { status: "COMPLETED" },
    });
    await transaction.interaction.create({
      data: {
        type: "FOLLOW_UP",
        summary: `Completed reminder: ${reminder.title}`,
        details: reminder.description,
        agentId: user.userId,
        customerId: reminder.customerId,
        leadId: reminder.leadId,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId: user.userId,
        action: "reminder.completed",
        entity: "Reminder",
        entityId: reminder.id,
      },
    });
  });
  revalidatePath("/dashboard/reminders");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/customers");
}

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireAuth();
  const notificationId = String(formData.get("notificationId") ?? "").trim();
  if (!notificationId) throw new Error("A notification must be selected.");
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count !== 1) throw new Error("Notification not found or already read.");
  revalidatePath("/dashboard/reminders");
  revalidatePath("/dashboard");
}

export async function logInteractionAction(formData: FormData) {
  const user = await requireAuth();
  if (!managerRoles.has(user.role) && user.role !== "PROPERTY_AGENT") {
    throw new Error("You are not authorized to log customer interactions.");
  }
  const parsed = interactionSchema.safeParse({
    type: formData.get("type"),
    summary: formData.get("summary"),
    details: String(formData.get("details") ?? "").trim(),
    leadId: String(formData.get("leadId") ?? ""),
    customerId: String(formData.get("customerId") ?? ""),
    followUpAt: String(formData.get("followUpAt") ?? "").trim() || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid interaction details.");

  const scope = managerRoles.has(user.role) ? {} : { assignedAgentId: user.userId };
  const [lead, customer] = await Promise.all([
    parsed.data.leadId
      ? prisma.lead.findFirst({ where: { id: parsed.data.leadId, ...scope }, select: { id: true, customerId: true, assignedAgentId: true } })
      : Promise.resolve(null),
    parsed.data.customerId
      ? prisma.customer.findFirst({ where: { id: parsed.data.customerId, ...scope }, select: { id: true, assignedAgentId: true } })
      : Promise.resolve(null),
  ]);
  if (parsed.data.leadId && !lead) throw new Error("The selected lead does not exist or is not assigned to you.");
  if (parsed.data.customerId && !customer) throw new Error("The selected customer does not exist or is not assigned to you.");
  if (lead && customer && lead.customerId !== customer.id) {
    throw new Error("The selected lead and customer are not linked.");
  }
  const customerId = customer?.id ?? lead?.customerId ?? null;

  await prisma.$transaction(async (transaction) => {
    const interaction = await transaction.interaction.create({
      data: {
        type: parsed.data.type,
        summary: parsed.data.summary,
        details: parsed.data.details || null,
        agentId: user.userId,
        leadId: lead?.id ?? null,
        customerId,
      },
    });
    if (parsed.data.followUpAt) {
      await transaction.reminder.create({
        data: {
          title: `Follow-up: ${parsed.data.summary}`,
          description: "Follow-up scheduled from a customer interaction.",
          dueAt: parsed.data.followUpAt,
          assignedToId: user.userId,
          createdById: user.userId,
          leadId: lead?.id ?? null,
          customerId,
          interactionId: interaction.id,
        },
      });
    }
    await transaction.auditLog.create({
      data: {
        actorId: user.userId,
        action: "customer.interaction.logged",
        entity: "Interaction",
        entityId: interaction.id,
        details: parsed.data.type,
      },
    });
  });
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/reminders");
  revalidatePath("/dashboard");
}
