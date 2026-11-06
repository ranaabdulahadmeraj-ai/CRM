"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth";
import { createSessionToken } from "@/lib/session";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { createWebsiteInquiry } from "@/lib/leads";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

const leadSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(32),
  whatsapp: z.string().trim().max(32).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  city: z.string().trim().max(100).optional(),
  budget: z.number().finite().min(0).optional(),
  propertySize: z.string().trim().max(100).optional(),
  investmentGoal: z.string().trim().max(200).optional(),
  message: z.string().trim().max(2000).optional(),
  source: z.enum(["WALK_IN", "PHONE_CALL", "WHATSAPP", "REFERRAL", "FACEBOOK", "INSTAGRAM", "GOOGLE"]),
});

const leadUpdateSchema = z.object({
  leadId: z.string().min(1),
  status: z.enum([
    "NEW_INQUIRY",
    "CONTACTED",
    "INTERESTED",
    "QUALIFIED",
    "SITE_VISIT_SCHEDULED",
    "NEGOTIATION",
    "CONVERTED",
    "LOST",
  ]),
  priority: z.enum(["Low", "Medium", "Hot"]),
  notes: z.string().trim().max(2000),
  assignedAgentId: z.string().optional(),
});

const appointmentSchema = z.object({
  title: z.string().trim().min(2).max(160),
  type: z.enum(["CALL", "MEETING", "PROPERTY_VISIT"]),
  appointmentDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    .transform((value) => new Date(`${value}:00+05:00`))
    .refine((value) => !Number.isNaN(value.getTime()), "Enter a valid appointment date and time."),
  location: z.string().trim().max(200).optional(),
  customerId: z.string().optional(),
  leadId: z.string().optional(),
  agentId: z.string().optional(),
}).refine((appointment) => appointment.customerId || appointment.leadId, {
  message: "Select a customer or lead for the appointment.",
});

const appointmentUpdateSchema = z.object({
  appointmentId: z.string().min(1),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "MISSED"]),
  notes: z.string().trim().max(2000),
});

const projectSchema = z.object({
  name: z.string().trim().min(2).max(160),
  developerName: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(100),
  location: z.string().trim().min(2).max(200),
  description: z.string().trim().min(10).max(3000),
  image: z.string().url().optional().or(z.literal("")),
  status: z.enum(["Active", "Coming Soon", "Archived"]),
  paymentPlans: z.string().trim().max(3000).optional(),
  featured: z.boolean(),
});

const propertySchema = z.object({
  title: z.string().trim().min(2).max(200),
  projectId: z.string().optional(),
  propertyType: z.enum([
    "Residential plots",
    "Commercial plots",
    "Houses",
    "Apartments",
    "Shops",
    "Offices",
    "Files",
    "Farmhouses",
    "Investment properties",
  ]),
  size: z.string().trim().min(1).max(100),
  location: z.string().trim().min(2).max(200),
  price: z.number().finite().positive(),
  owner: z.string().trim().max(160).optional(),
  assignedAgentId: z.string().optional(),
  image: z.string().url().optional().or(z.literal("")),
  description: z.string().trim().max(3000).optional(),
});

const propertyStatusSchema = z.object({
  propertyId: z.string().min(1),
  availability: z.enum(["Available", "Reserved", "Sold", "Rented", "Under Negotiation", "Archived"]),
});

const customerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(32),
  whatsapp: z.string().trim().max(32).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  city: z.string().trim().max(100).optional(),
  budget: z.number().finite().min(0).optional(),
  preferredLocations: z.string().trim().max(500).optional(),
  propertyPreferences: z.string().trim().max(500).optional(),
  investmentObjective: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  assignedAgentId: z.string().optional(),
});

const dealSchema = z.object({
  propertyId: z.string().min(1),
  buyerId: z.string().min(1),
  dealValue: z.number().int().positive(),
  bookingAmount: z.number().int().nonnegative(),
  advancePayment: z.number().int().nonnegative(),
  commissionRate: z.number().finite().min(0).max(100),
  agencyShareRate: z.number().finite().min(0).max(100),
  installmentCount: z.number().int().min(1).max(120),
  firstInstallmentDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((value) => new Date(`${value}T12:00:00+05:00`))
    .refine((value) => !Number.isNaN(value.getTime()), "Enter a valid first installment date."),
  expectedClosingDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((value) => new Date(`${value}T23:59:59+05:00`))
    .refine((value) => !Number.isNaN(value.getTime()), "Enter a valid closing date.")
    .optional(),
  agentId: z.string().optional(),
}).refine((deal) => deal.bookingAmount + deal.advancePayment <= deal.dealValue, {
  message: "Booking and advance payments cannot exceed the deal value.",
});

const dealPaymentSchema = z.object({
  dealId: z.string().min(1),
  amount: z.number().int().positive(),
  description: z.string().trim().max(300).optional(),
});

const dealStatusSchema = z.object({
  dealId: z.string().min(1),
  status: z.enum(["NEGOTIATION", "BOOKING", "DOCUMENTATION", "AGREEMENT_SIGNED", "PAYMENT_PENDING", "COMPLETED", "CANCELLED"]),
});

const projectManagementRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"]);
const propertyManagementRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"]);
const customerManagementRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"]);
const leadManagementRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"]);
const appointmentManagementRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"]);
const dealManagementRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "MANAGER"]);
const financeRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "ACCOUNTANT"]);

export async function loginAction(formData: FormData) {
  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    redirect("/login?error=invalid");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  if (!user) {
    redirect("/login?error=invalid");
  }

  const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!passwordMatches) {
    redirect("/login?error=invalid");
  }

  const cookieStore = await cookies();
  cookieStore.set("session", createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  redirect("/login");
}

export async function createProjectAction(formData: FormData) {
  await requireRole([...projectManagementRoles]);
  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    developerName: formData.get("developerName"),
    city: formData.get("city"),
    location: formData.get("location"),
    description: formData.get("description"),
    image: String(formData.get("image") ?? "").trim(),
    status: formData.get("status"),
    paymentPlans: String(formData.get("paymentPlans") ?? "").trim(),
    featured: formData.get("featured") === "on",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid project details.");
  }

  await prisma.project.create({
    data: {
      ...parsed.data,
      image: parsed.data.image || null,
      paymentPlans: parsed.data.paymentPlans || null,
    },
  });
  revalidatePath("/dashboard/projects");
  revalidatePath("/");
}

export async function createPropertyAction(formData: FormData) {
  const user = await requireAuth();
  const canAssign = propertyManagementRoles.has(user.role);
  if (!canAssign && user.role !== "PROPERTY_AGENT") {
    throw new Error("You are not authorized to create properties.");
  }

  const parsed = propertySchema.safeParse({
    title: formData.get("title"),
    projectId: String(formData.get("projectId") ?? ""),
    propertyType: formData.get("propertyType"),
    size: formData.get("size"),
    location: formData.get("location"),
    price: Number(formData.get("price")),
    owner: String(formData.get("owner") ?? "").trim(),
    assignedAgentId: String(formData.get("assignedAgentId") ?? ""),
    image: String(formData.get("image") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid property details.");
  }

  if (parsed.data.projectId) {
    const project = await prisma.project.findUnique({
      where: { id: parsed.data.projectId },
      select: { id: true },
    });
    if (!project) throw new Error("Choose an existing project.");
  }

  let assignedAgentId: string | null = user.role === "PROPERTY_AGENT" ? user.userId : null;
  if (canAssign && parsed.data.assignedAgentId) {
    const agent = await prisma.user.findFirst({
      where: { id: parsed.data.assignedAgentId, role: "PROPERTY_AGENT" },
      select: { id: true },
    });
    if (!agent) throw new Error("Choose an existing property agent.");
    assignedAgentId = agent.id;
  }

  await prisma.property.create({
    data: {
      title: parsed.data.title,
      projectId: parsed.data.projectId || null,
      propertyType: parsed.data.propertyType,
      size: parsed.data.size,
      location: parsed.data.location,
      price: parsed.data.price,
      owner: parsed.data.owner || null,
      assignedAgentId,
      image: parsed.data.image || null,
      description: parsed.data.description || null,
      availability: "Available",
    },
  });
  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function updatePropertyStatusAction(formData: FormData) {
  const user = await requireAuth();
  if (!propertyManagementRoles.has(user.role) && user.role !== "PROPERTY_AGENT") {
    throw new Error("You are not authorized to update properties.");
  }
  const parsed = propertyStatusSchema.safeParse({
    propertyId: formData.get("propertyId"),
    availability: formData.get("availability"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid property status.");
  }

  const result = await prisma.property.updateMany({
    where: {
      id: parsed.data.propertyId,
      ...(propertyManagementRoles.has(user.role) ? {} : { assignedAgentId: user.userId }),
    },
    data: { availability: parsed.data.availability },
  });
  if (result.count !== 1) {
    throw new Error("Property not found or you do not have access to it.");
  }
  revalidatePath("/dashboard/properties");
  revalidatePath("/");
}

export async function createCustomerAction(formData: FormData) {
  const user = await requireAuth();
  const canAssign = customerManagementRoles.has(user.role);
  if (!canAssign && user.role !== "PROPERTY_AGENT") {
    throw new Error("You are not authorized to create customers.");
  }

  const parsed = customerSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    whatsapp: String(formData.get("whatsapp") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    budget: String(formData.get("budget") ?? "").trim()
      ? Number(formData.get("budget"))
      : undefined,
    preferredLocations: String(formData.get("preferredLocations") ?? "").trim(),
    propertyPreferences: String(formData.get("propertyPreferences") ?? "").trim(),
    investmentObjective: String(formData.get("investmentObjective") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
    assignedAgentId: String(formData.get("assignedAgentId") ?? ""),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid customer details.");
  }

  const email = parsed.data.email?.toLowerCase() || undefined;
  const duplicate = await prisma.customer.findFirst({
    where: {
      OR: [
        { phone: parsed.data.phone },
        ...(email ? [{ email }] : []),
      ],
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new Error("A customer with this phone number or email already exists.");
  }

  let assignedAgentId: string | null = user.role === "PROPERTY_AGENT" ? user.userId : null;
  if (canAssign && parsed.data.assignedAgentId) {
    const agent = await prisma.user.findFirst({
      where: { id: parsed.data.assignedAgentId, role: "PROPERTY_AGENT" },
      select: { id: true },
    });
    if (!agent) throw new Error("Choose an existing property agent.");
    assignedAgentId = agent.id;
  }
  await prisma.customer.create({
    data: {
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      whatsapp: parsed.data.whatsapp || null,
      email: email || null,
      city: parsed.data.city || null,
      budget: parsed.data.budget,
      preferredLocations: parsed.data.preferredLocations || null,
      propertyPreferences: parsed.data.propertyPreferences || null,
      investmentObjective: parsed.data.investmentObjective || null,
      notes: parsed.data.notes || null,
      assignedAgentId,
    },
  });
  revalidatePath("/dashboard/customers");
}

export async function convertLeadAction(formData: FormData) {
  const user = await requireAuth();
  if (!leadManagementRoles.has(user.role) && user.role !== "PROPERTY_AGENT") {
    throw new Error("You are not authorized to convert leads.");
  }
  const leadId = String(formData.get("leadId") ?? "").trim();
  if (!leadId) throw new Error("A lead must be selected.");

  await prisma.$transaction(async (transaction) => {
    const lead = await transaction.lead.findFirst({
      where: {
        id: leadId,
        ...(leadManagementRoles.has(user.role) ? {} : { assignedAgentId: user.userId }),
      },
    });
    if (!lead) throw new Error("Lead not found or you do not have access to it.");
    if (lead.status === "LOST") throw new Error("A lost lead cannot be converted.");

    const assignedAgentId = lead.assignedAgentId ?? (user.role === "PROPERTY_AGENT" ? user.userId : null);
    if (lead.customerId) {
      const customer = await transaction.customer.findUnique({ where: { id: lead.customerId } });
      if (!customer) throw new Error("The linked customer record no longer exists.");
      await transaction.customer.update({
        where: { id: customer.id },
        data: {
          whatsapp: customer.whatsapp ?? lead.whatsapp,
          email: customer.email ?? lead.email,
          city: customer.city ?? lead.city,
          budget: customer.budget ?? lead.budget,
          propertyPreferences: customer.propertyPreferences ?? lead.propertySize,
          investmentObjective: customer.investmentObjective ?? lead.investmentGoal,
          notes: customer.notes ?? lead.message,
          assignedAgentId: customer.assignedAgentId ?? assignedAgentId,
        },
      });
    } else {
      const customer = await transaction.customer.create({
        data: {
          fullName: lead.fullName,
          phone: lead.phone,
          whatsapp: lead.whatsapp,
          email: lead.email,
          city: lead.city,
          budget: lead.budget,
          propertyPreferences: lead.propertySize,
          investmentObjective: lead.investmentGoal,
          notes: lead.message,
          assignedAgentId,
        },
        select: { id: true },
      });
      await transaction.lead.update({
        where: { id: lead.id },
        data: { customerId: customer.id, status: "CONVERTED" },
      });
      return;
    }

    await transaction.lead.update({
      where: { id: lead.id },
      data: { status: "CONVERTED" },
    });
  });

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard");
}

export async function createDealAction(formData: FormData) {
  const user = await requireAuth();
  if (!dealManagementRoles.has(user.role) && user.role !== "PROPERTY_AGENT") {
    throw new Error("You are not authorized to create deals.");
  }
  const parsed = dealSchema.safeParse({
    propertyId: formData.get("propertyId"),
    buyerId: formData.get("buyerId"),
    dealValue: Number(formData.get("dealValue")),
    bookingAmount: Number(formData.get("bookingAmount") || 0),
    advancePayment: Number(formData.get("advancePayment") || 0),
    commissionRate: Number(formData.get("commissionRate") || 0),
    agencyShareRate: Number(formData.get("agencyShareRate") || 60),
    installmentCount: Number(formData.get("installmentCount") || 12),
    firstInstallmentDate: String(formData.get("firstInstallmentDate") ?? "").trim()
      || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    expectedClosingDate: String(formData.get("expectedClosingDate") ?? "").trim() || undefined,
    agentId: String(formData.get("agentId") ?? ""),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid deal details.");
  }

  const canAssign = dealManagementRoles.has(user.role);
  let agentId: string | null = user.role === "PROPERTY_AGENT" ? user.userId : null;
  if (canAssign && parsed.data.agentId) {
    const agent = await prisma.user.findFirst({
      where: { id: parsed.data.agentId, role: "PROPERTY_AGENT" },
      select: { id: true },
    });
    if (!agent) throw new Error("Choose an existing property agent.");
    agentId = agent.id;
  }

  const dealId = `DL-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const initialPayment = parsed.data.bookingAmount + parsed.data.advancePayment;
  await prisma.$transaction(async (transaction) => {
    const property = await transaction.property.findFirst({
      where: {
        id: parsed.data.propertyId,
        availability: "Available",
        ...(user.role === "PROPERTY_AGENT" ? { assignedAgentId: user.userId } : {}),
      },
      select: { id: true, projectId: true },
    });
    if (!property) {
      throw new Error("Property is unavailable or not assigned to you.");
    }

    const buyer = await transaction.customer.findFirst({
      where: {
        id: parsed.data.buyerId,
        ...(user.role === "PROPERTY_AGENT" ? { assignedAgentId: user.userId } : {}),
      },
      select: { id: true },
    });
    if (!buyer) throw new Error("Buyer not found or not assigned to you.");

    const reserved = await transaction.property.updateMany({
      where: { id: property.id, availability: "Available" },
      data: { availability: "Reserved" },
    });
    if (reserved.count !== 1) throw new Error("This property has just been reserved by another deal.");

    const deal = await transaction.deal.create({
      data: {
        dealId,
        propertyId: property.id,
        projectId: property.projectId,
        buyerId: buyer.id,
        agentId,
        dealValue: parsed.data.dealValue,
        bookingAmount: parsed.data.bookingAmount,
        advancePayment: parsed.data.advancePayment,
        remainingBalance: parsed.data.dealValue - initialPayment,
        dealDate: new Date(),
        expectedClosingDate: parsed.data.expectedClosingDate,
        status: initialPayment > 0 ? "BOOKING" : "NEGOTIATION",
        commissionRate: parsed.data.commissionRate,
        commissionAmount: Math.round(parsed.data.dealValue * parsed.data.commissionRate / 100),
      },
    });

    const balanceToSchedule = parsed.data.dealValue - initialPayment;
    if (initialPayment > 0) {
      const depositInstallment = await transaction.installment.create({
        data: {
          dealId: deal.id,
          sequence: 1,
          title: "Booking and advance payment",
          dueDate: new Date(),
          amount: initialPayment,
          amountPaid: initialPayment,
          status: "PAID",
          paidAt: new Date(),
        },
      });
      await transaction.installmentPayment.create({
        data: {
          installmentId: depositInstallment.id,
          amount: initialPayment,
          reference: dealId,
          notes: "Booking and advance payment received when deal was created.",
        },
      });
    }
    if (balanceToSchedule > 0) {
      const count = Math.min(parsed.data.installmentCount, balanceToSchedule);
      const baseAmount = Math.floor(balanceToSchedule / count);
      const remainder = balanceToSchedule % count;
      for (let index = 0; index < count; index += 1) {
        const dueDate = new Date(parsed.data.firstInstallmentDate);
        dueDate.setMonth(dueDate.getMonth() + index);
        await transaction.installment.create({
          data: {
            dealId: deal.id,
            sequence: index + (initialPayment > 0 ? 2 : 1),
            title: `Installment ${index + 1}`,
            dueDate,
            amount: baseAmount + (index < remainder ? 1 : 0),
          },
        });
      }
    }

    if (deal.commissionAmount && deal.commissionAmount > 0) {
      const agentShareRate = agentId ? 100 - parsed.data.agencyShareRate : 0;
      await transaction.commission.create({
        data: {
          dealId: deal.id,
          agentId,
          totalCommission: deal.commissionAmount,
          agencyShare: Math.round(deal.commissionAmount * parsed.data.agencyShareRate / 100),
          agentShare: deal.commissionAmount - Math.round(deal.commissionAmount * parsed.data.agencyShareRate / 100),
          agencyShareRate: agentId ? parsed.data.agencyShareRate : 100,
          agentShareRate,
        },
      });
    }

    if (initialPayment > 0) {
      await transaction.financialEntry.create({
        data: {
          type: "INCOME",
          category: "Deal payment",
          amount: initialPayment,
          description: `Initial payment received for ${dealId}`,
          reference: dealId,
        },
      });
    }
  });

  revalidatePath("/dashboard/deals");
  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard");
}

export async function recordDealPaymentAction(formData: FormData) {
  await requireRole([...financeRoles]);
  const parsed = dealPaymentSchema.safeParse({
    dealId: formData.get("dealId"),
    amount: Number(formData.get("amount")),
    description: String(formData.get("description") ?? "").trim(),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid payment details.");
  }

  await prisma.$transaction(async (transaction) => {
    const deal = await transaction.deal.findUnique({
      where: { dealId: parsed.data.dealId },
      select: { id: true, dealId: true, status: true, remainingBalance: true },
    });
    if (!deal || ["COMPLETED", "CANCELLED"].includes(deal.status)) {
      throw new Error("Payment cannot be added to this deal.");
    }

    const updated = await transaction.deal.updateMany({
      where: { id: deal.id, remainingBalance: { gte: parsed.data.amount } },
      data: {
        advancePayment: { increment: parsed.data.amount },
        remainingBalance: { decrement: parsed.data.amount },
      },
    });
    if (updated.count !== 1) throw new Error("Payment exceeds the deal's remaining balance.");

    let installments = await transaction.installment.findMany({
      where: { dealId: deal.id, status: { not: "PAID" } },
      orderBy: { sequence: "asc" },
    });
    if (installments.length === 0) {
      installments = [await transaction.installment.create({
        data: {
          dealId: deal.id,
          sequence: 1,
          title: "Outstanding balance",
          dueDate: new Date(),
          amount: deal.remainingBalance ?? parsed.data.amount,
        },
      })];
    }

    let remainingPayment = parsed.data.amount;
    for (const installment of installments) {
      if (remainingPayment <= 0) break;
      const unpaid = installment.amount - installment.amountPaid;
      if (unpaid <= 0) continue;
      const applied = Math.min(unpaid, remainingPayment);
      const amountPaid = installment.amountPaid + applied;
      await transaction.installmentPayment.create({
        data: {
          installmentId: installment.id,
          amount: applied,
          reference: deal.dealId,
          notes: parsed.data.description || null,
        },
      });
      await transaction.installment.update({
        where: { id: installment.id },
        data: {
          amountPaid,
          status: amountPaid >= installment.amount ? "PAID" : "PARTIAL",
          paidAt: amountPaid >= installment.amount ? new Date() : null,
        },
      });
      remainingPayment -= applied;
    }
    if (remainingPayment > 0) throw new Error("Payment exceeds all scheduled installments.");

    await transaction.financialEntry.create({
      data: {
        type: "INCOME",
        category: "Deal payment",
        amount: parsed.data.amount,
        description: parsed.data.description || `Payment received for ${deal.dealId}`,
        reference: deal.dealId,
      },
    });
  });

  revalidatePath("/dashboard/deals");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard");
}

export async function updateDealStatusAction(formData: FormData) {
  const user = await requireAuth();
  if (!dealManagementRoles.has(user.role) && user.role !== "PROPERTY_AGENT") {
    throw new Error("You are not authorized to update deals.");
  }
  const parsed = dealStatusSchema.safeParse({
    dealId: formData.get("dealId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid deal status.");
  }

  await prisma.$transaction(async (transaction) => {
    const deal = await transaction.deal.findFirst({
      where: {
        dealId: parsed.data.dealId,
        ...(user.role === "PROPERTY_AGENT" ? { agentId: user.userId } : {}),
      },
      select: { id: true, propertyId: true, dealValue: true, remainingBalance: true, bookingAmount: true, advancePayment: true, status: true },
    });
    if (!deal) throw new Error("Deal not found or you do not have access to it.");
    if (["COMPLETED", "CANCELLED"].includes(deal.status) && deal.status !== parsed.data.status) {
      throw new Error("Completed or cancelled deals cannot be reopened.");
    }
    const remainingBalance = deal.remainingBalance ?? Math.max(
      deal.dealValue - (deal.bookingAmount ?? 0) - (deal.advancePayment ?? 0),
      0
    );
    if (parsed.data.status === "COMPLETED" && remainingBalance > 0) {
      throw new Error("A deal must be fully paid before it can be completed.");
    }
    if (parsed.data.status === "CANCELLED" && ((deal.bookingAmount ?? 0) > 0 || (deal.advancePayment ?? 0) > 0)) {
      throw new Error("This deal has recorded payments. Resolve or refund those payments before cancellation.");
    }

    await transaction.deal.update({
      where: { id: deal.id },
      data: { status: parsed.data.status },
    });
    if (deal.propertyId && parsed.data.status === "COMPLETED") {
      await transaction.property.update({
        where: { id: deal.propertyId },
        data: { availability: "Sold" },
      });
    } else if (deal.propertyId && parsed.data.status === "CANCELLED") {
      const activeDeals = await transaction.deal.count({
        where: { propertyId: deal.propertyId, id: { not: deal.id }, status: { not: "CANCELLED" } },
      });
      if (activeDeals === 0) {
        await transaction.property.update({
          where: { id: deal.propertyId },
          data: { availability: "Available" },
        });
      }
    }
  });

  revalidatePath("/dashboard/deals");
  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard");
}

export async function createLeadAction(formData: FormData) {
  const user = await requireAuth();
  if (!leadManagementRoles.has(user.role) && user.role !== "PROPERTY_AGENT") {
    throw new Error("You are not authorized to create leads.");
  }
  const parsed = leadSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    whatsapp: String(formData.get("whatsapp") ?? "").trim() || undefined,
    email: String(formData.get("email") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    budget: String(formData.get("budget") ?? "").trim()
      ? Number(formData.get("budget"))
      : undefined,
    propertySize: String(formData.get("propertySize") ?? "").trim(),
    investmentGoal: String(formData.get("investmentGoal") ?? "").trim(),
    message: String(formData.get("message") ?? "").trim(),
    source: formData.get("source"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid lead details.");
  }

  const payload = parsed.data;
  const email = payload.email?.toLowerCase() || undefined;
  const duplicate = await prisma.lead.findFirst({
    where: {
      OR: [
        { phone: payload.phone },
        ...(email ? [{ email }] : []),
      ],
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new Error("A lead with this phone number or email already exists.");
  }

  await prisma.lead.create({
    data: {
      fullName: payload.fullName,
      phone: payload.phone,
      whatsapp: payload.whatsapp || null,
      email: email || null,
      city: payload.city || null,
      budget: payload.budget,
      propertySize: payload.propertySize || null,
      investmentGoal: payload.investmentGoal || null,
      message: payload.message || null,
      source: payload.source,
      status: "NEW_INQUIRY",
      priority: "Medium",
      assignedAgentId: user.role === "PROPERTY_AGENT" ? user.userId : null,
    },
  });

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard");
}

export async function updateLeadAction(formData: FormData) {
  const user = await requireAuth();
  if (!leadManagementRoles.has(user.role) && user.role !== "PROPERTY_AGENT") {
    throw new Error("You are not authorized to update leads.");
  }

  const parsed = leadUpdateSchema.safeParse({
    leadId: formData.get("leadId"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    notes: String(formData.get("notes") ?? ""),
    assignedAgentId: String(formData.get("assignedAgentId") ?? ""),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid lead update.");
  }

  const canAssign = leadManagementRoles.has(user.role);
  await prisma.$transaction(async (transaction) => {
    const lead = await transaction.lead.findFirst({
      where: {
        id: parsed.data.leadId,
        ...(canAssign ? {} : { assignedAgentId: user.userId }),
      },
      select: { id: true, customerId: true, assignedAgentId: true },
    });
    if (!lead) throw new Error("Lead not found or you do not have access to it.");
    if (parsed.data.status === "CONVERTED" && !lead.customerId) {
      throw new Error("Use the customer conversion action to move a lead to Converted.");
    }

    let assignedAgentId = lead.assignedAgentId;
    if (canAssign) {
      assignedAgentId = parsed.data.assignedAgentId || null;
      if (assignedAgentId && assignedAgentId !== lead.assignedAgentId) {
        const assignedUser = await transaction.user.findFirst({
          where: { id: assignedAgentId, role: "PROPERTY_AGENT" },
          select: { id: true },
        });
        if (!assignedUser) throw new Error("Choose an existing property agent for lead assignment.");
      }
    }

    await transaction.lead.update({
      where: { id: lead.id },
      data: {
        status: parsed.data.status,
        priority: parsed.data.priority,
        notes: parsed.data.notes || null,
        ...(canAssign ? { assignedAgentId } : {}),
      },
    });
    if (canAssign && lead.customerId) {
      await transaction.customer.update({
        where: { id: lead.customerId },
        data: { assignedAgentId },
      });
    }
  });

  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard");
}

export async function createAppointmentAction(formData: FormData) {
  const user = await requireAuth();
  const canAssign = appointmentManagementRoles.has(user.role);
  if (!canAssign && user.role !== "PROPERTY_AGENT") {
    throw new Error("You are not authorized to schedule appointments.");
  }

  const parsed = appointmentSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    appointmentDate: formData.get("appointmentDate"),
    location: String(formData.get("location") ?? "").trim(),
    customerId: String(formData.get("customerId") ?? ""),
    leadId: String(formData.get("leadId") ?? ""),
    agentId: String(formData.get("agentId") ?? ""),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid appointment details.");
  }
  if (parsed.data.appointmentDate.getTime() <= Date.now()) {
    throw new Error("Choose a future date and time for the appointment.");
  }

  const scope = canAssign ? {} : { assignedAgentId: user.userId };
  const [lead, customer] = await Promise.all([
    parsed.data.leadId
      ? prisma.lead.findFirst({ where: { id: parsed.data.leadId, ...scope }, select: { id: true, customerId: true } })
      : Promise.resolve(null),
    parsed.data.customerId
      ? prisma.customer.findFirst({ where: { id: parsed.data.customerId, ...scope }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  if (parsed.data.leadId && !lead) {
    throw new Error("The selected lead does not exist or is not assigned to you.");
  }
  if (parsed.data.customerId && !customer) {
    throw new Error("The selected customer does not exist or is not assigned to you.");
  }
  if (lead && customer && lead.customerId !== customer.id) {
    throw new Error("The selected lead and customer do not match.");
  }

  let agentId: string | null = canAssign ? null : user.userId;
  if (canAssign && parsed.data.agentId) {
    const agent = await prisma.user.findFirst({
      where: { id: parsed.data.agentId, role: "PROPERTY_AGENT" },
      select: { id: true },
    });
    if (!agent) throw new Error("Choose an existing property agent.");
    agentId = agent.id;
  }

  await prisma.$transaction(async (transaction) => {
    const appointment = await transaction.appointment.create({
      data: {
        title: parsed.data.title,
        type: parsed.data.type,
        appointmentDate: parsed.data.appointmentDate,
        location: parsed.data.location || null,
        customerId: customer?.id ?? lead?.customerId ?? null,
        leadId: lead?.id ?? null,
        agentId,
        status: "SCHEDULED",
      },
    });
    if (agentId) {
      await transaction.reminder.create({
        data: {
          title: `Prepare for ${appointment.title}`,
          description: "Appointment reminder automatically scheduled for the assigned agent.",
          dueAt: new Date(Math.max(Date.now(), appointment.appointmentDate.getTime() - 24 * 60 * 60 * 1000)),
          assignedToId: agentId,
          createdById: user.userId,
          customerId: appointment.customerId,
          leadId: appointment.leadId,
          appointmentId: appointment.id,
        },
      });
    }
  });

  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard");
}

export async function updateAppointmentAction(formData: FormData) {
  const user = await requireAuth();
  if (!appointmentManagementRoles.has(user.role) && user.role !== "PROPERTY_AGENT") {
    throw new Error("You are not authorized to update appointments.");
  }

  const parsed = appointmentUpdateSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    status: formData.get("status"),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid appointment update.");
  }

  await prisma.$transaction(async (transaction) => {
    const appointment = await transaction.appointment.findFirst({
      where: {
        id: parsed.data.appointmentId,
        ...(appointmentManagementRoles.has(user.role) ? {} : { agentId: user.userId }),
      },
    });
    if (!appointment) throw new Error("Appointment not found or you do not have access to it.");

    await transaction.appointment.update({
      where: { id: appointment.id },
      data: { status: parsed.data.status, notes: parsed.data.notes || null },
    });

    if (parsed.data.status === "COMPLETED" && appointment.status !== "COMPLETED") {
      await transaction.interaction.create({
        data: {
          type: appointment.type === "CALL"
            ? "CALL"
            : appointment.type === "PROPERTY_VISIT"
              ? "PROPERTY_VISIT"
              : "MEETING",
          summary: `Completed appointment: ${appointment.title}`,
          details: parsed.data.notes || appointment.notes,
          agentId: appointment.agentId ?? user.userId,
          customerId: appointment.customerId,
          leadId: appointment.leadId,
          appointmentId: appointment.id,
        },
      });
    }

    if (["COMPLETED", "CANCELLED", "MISSED"].includes(parsed.data.status)) {
      await transaction.reminder.updateMany({
        where: { appointmentId: appointment.id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
    }
    await transaction.auditLog.create({
      data: {
        actorId: user.userId,
        action: "appointment.updated",
        entity: "Appointment",
        entityId: appointment.id,
        details: parsed.data.status,
      },
    });
  });

  revalidatePath("/dashboard/appointments");
  revalidatePath("/dashboard");
}

export async function submitInquiry(formData: FormData) {
  const result = await createWebsiteInquiry({
    fullName: formData.get("fullName") ?? "",
    phone: formData.get("phone") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    email: formData.get("email") ?? "",
    budget: formData.get("budget") ?? 0,
    city: formData.get("city") ?? "",
    message: formData.get("message") ?? "",
    project: formData.get("project") ?? "",
    propertySize: formData.get("propertySize") ?? "",
    investmentGoal: formData.get("investmentGoal") ?? "",
  });
  if (result.kind === "invalid") {
    redirect("/?status=invalid");
  }
  if (result.kind === "duplicate") {
    redirect("/?status=duplicate");
  }
  redirect("/?status=success");
}
