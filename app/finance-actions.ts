"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const financeRoles = ["SUPER_ADMIN", "AGENCY_ADMIN", "ACCOUNTANT"] as const;

const commissionPaymentSchema = z.object({
  commissionId: z.string().min(1),
  agencyAmount: z.number().int().nonnegative(),
  agentAmount: z.number().int().nonnegative(),
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(300).optional(),
}).refine((payment) => payment.agencyAmount + payment.agentAmount > 0, {
  message: "Enter an agency receipt or agent payout.",
});

export async function recordCommissionPaymentAction(formData: FormData) {
  const user = await requireRole([...financeRoles]);
  const parsed = commissionPaymentSchema.safeParse({
    commissionId: formData.get("commissionId"),
    agencyAmount: Number(formData.get("agencyAmount") || 0),
    agentAmount: Number(formData.get("agentAmount") || 0),
    reference: String(formData.get("reference") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid commission payment details.");
  }

  await prisma.$transaction(async (transaction) => {
    const commission = await transaction.commission.findUnique({
      where: { id: parsed.data.commissionId },
      select: {
        id: true,
        totalCommission: true,
        agencyShare: true,
        agentShare: true,
        deal: { select: { dealId: true } },
        payments: { select: { agencyAmount: true, agentAmount: true } },
      },
    });
    if (!commission) throw new Error("Commission agreement not found.");

    const agencyPaid = commission.payments.reduce((sum, payment) => sum + payment.agencyAmount, 0);
    const agentPaid = commission.payments.reduce((sum, payment) => sum + payment.agentAmount, 0);
    const agencyDue = commission.agencyShare - agencyPaid;
    const agentDue = commission.agentShare - agentPaid;
    if (parsed.data.agencyAmount > agencyDue || parsed.data.agentAmount > agentDue) {
      throw new Error("Payment exceeds the remaining agency or agent commission share.");
    }

    await transaction.commissionPayment.create({
      data: {
        commissionId: commission.id,
        agencyAmount: parsed.data.agencyAmount,
        agentAmount: parsed.data.agentAmount,
        reference: parsed.data.reference || null,
        notes: parsed.data.notes || null,
        recordedById: user.userId,
      },
    });

    if (parsed.data.agencyAmount > 0) {
      await transaction.financialEntry.create({
        data: {
          type: "INCOME",
          category: "Agency commission receipt",
          amount: parsed.data.agencyAmount,
          description: `Agency commission received${commission.deal ? ` for ${commission.deal.dealId}` : ""}`,
          reference: parsed.data.reference || commission.deal?.dealId || commission.id,
        },
      });
    }
    if (parsed.data.agentAmount > 0) {
      await transaction.financialEntry.create({
        data: {
          type: "EXPENSE",
          category: "Agent commission payout",
          amount: parsed.data.agentAmount,
          description: `Agent commission paid${commission.deal ? ` for ${commission.deal.dealId}` : ""}`,
          reference: parsed.data.reference || commission.deal?.dealId || commission.id,
        },
      });
    }

    const fullyPaid = agencyPaid + parsed.data.agencyAmount >= commission.agencyShare
      && agentPaid + parsed.data.agentAmount >= commission.agentShare;
    await transaction.commission.update({
      where: { id: commission.id },
      data: { status: fullyPaid ? "PAID" : "PARTIAL" },
    });
    await transaction.auditLog.create({
      data: {
        actorId: user.userId,
        action: "commission.payment.recorded",
        entity: "Commission",
        entityId: commission.id,
        details: `Agency ${parsed.data.agencyAmount}; agent ${parsed.data.agentAmount}`,
      },
    });
  });

  revalidatePath("/dashboard/deals");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard");
}
