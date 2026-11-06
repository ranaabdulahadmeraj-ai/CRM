import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || secret.length < 32 || !authorization.startsWith("Bearer ")) return false;
  const provided = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized scheduler request." }, { status: 401 });
  }

  const now = new Date();
  try {
    const [overdueInstallments, dueReminders] = await Promise.all([
      prisma.installment.updateMany({
        where: {
          dueDate: { lt: now },
          status: { in: ["PENDING", "PARTIAL"] },
        },
        data: { status: "OVERDUE" },
      }),
      prisma.reminder.findMany({
        where: { status: "PENDING", dueAt: { lte: now }, notifiedAt: null },
        orderBy: { dueAt: "asc" },
        take: 500,
      }),
    ]);

    let notificationsCreated = 0;
    for (const reminder of dueReminders) {
      const created = await prisma.$transaction(async (transaction) => {
        const claimed = await transaction.reminder.updateMany({
          where: { id: reminder.id, status: "PENDING", notifiedAt: null },
          data: { notifiedAt: now },
        });
        if (claimed.count !== 1) return false;
        await transaction.notification.upsert({
          where: { reminderId: reminder.id },
          create: {
            userId: reminder.assignedToId,
            reminderId: reminder.id,
            title: reminder.title,
            message: reminder.description ?? "A scheduled follow-up is due.",
          },
          update: {},
        });
        return true;
      });
      if (created) notificationsCreated += 1;
    }

    return NextResponse.json({
      success: true,
      notificationsCreated,
      overdueInstallments: overdueInstallments.count,
      checkedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Reminder scheduler failed to process due work.", error);
    return NextResponse.json({ error: "Unable to process reminders." }, { status: 500 });
  }
}
