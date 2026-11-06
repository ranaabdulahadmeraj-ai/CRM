import "server-only";
import { prisma } from "@/lib/prisma";

type DashboardUser = { userId: string; role: string };
const financeRoles: ReadonlySet<string> = new Set(["SUPER_ADMIN", "AGENCY_ADMIN", "ACCOUNTANT"]);

export async function getDashboardData(user: DashboardUser) {
  const isAgent = user.role === "PROPERTY_AGENT";
  const canViewCrm = user.role !== "ACCOUNTANT";
  const canViewFinance = financeRoles.has(user.role);
  const [projects, properties, leads, customers, deals, appointments, entries, agents, interactions, reminders, notifications, overdueReminderCount] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { properties: true },
    }),
    prisma.property.findMany({
      where: isAgent ? { assignedAgentId: user.userId } : {},
      orderBy: { createdAt: "desc" },
      include: { assignedAgent: true, project: true },
    }),
    canViewCrm
      ? prisma.lead.findMany({
          where: isAgent ? { assignedAgentId: user.userId } : {},
          orderBy: { createdAt: "desc" },
          include: { assignedAgent: true, selectedProject: true },
        })
      : Promise.resolve([]),
    canViewCrm
      ? prisma.customer.findMany({
          where: isAgent ? { assignedAgentId: user.userId } : {},
          orderBy: { createdAt: "desc" },
          include: { assignedAgent: true },
        })
      : Promise.resolve([]),
    prisma.deal.findMany({
      where: isAgent ? { agentId: user.userId } : {},
      orderBy: { dealDate: "desc" },
      include: { property: true, buyer: true, seller: true, agent: true, commissions: { include: { payments: true } } },
    }),
    canViewCrm
      ? prisma.appointment.findMany({
          where: isAgent ? { agentId: user.userId } : {},
          orderBy: { appointmentDate: "asc" },
          include: { customer: true, lead: true, agent: true },
        })
      : Promise.resolve([]),
    canViewFinance
      ? prisma.financialEntry.findMany({ orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    canViewCrm
      ? prisma.user.findMany({
          where: { role: "PROPERTY_AGENT", ...(isAgent ? { id: user.userId } : {}) },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    canViewCrm
      ? prisma.interaction.findMany({
          where: isAgent ? { agentId: user.userId } : {},
          orderBy: { occurredAt: "desc" },
          select: { agentId: true, type: true, summary: true, occurredAt: true },
        })
      : Promise.resolve([]),
    prisma.reminder.findMany({
      where: isAgent ? { assignedToId: user.userId } : {},
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      take: 100,
      include: { lead: { select: { fullName: true } }, customer: { select: { fullName: true } }, assignedTo: { select: { name: true } } },
    }),
    prisma.notification.findMany({
      where: { userId: user.userId, readAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.reminder.count({
      where: {
        status: "PENDING",
        dueAt: { lt: new Date() },
        ...(isAgent ? { assignedToId: user.userId } : {}),
      },
    }),
  ]);
  const dealReferences = deals
    .filter((deal) => deal.status !== "CANCELLED")
    .map((deal) => deal.dealId);
  const dealReceipts = dealReferences.length
    ? await prisma.financialEntry.findMany({
        where: { type: "INCOME", category: "Deal payment", reference: { in: dealReferences } },
        select: { amount: true, createdAt: true },
      })
    : [];

  const totalProperties = properties.length;
  const activeProjects = projects.filter((project) => project.status !== "Archived").length;
  const totalCustomers = customers.length;
  const newWebsiteInquiries = leads.filter((lead) => lead.source === "WEBSITE").length;
  const activeLeads = leads.filter((lead) => !["CONVERTED", "LOST"].includes(lead.status)).length;
  const hotLeads = leads.filter((lead) => lead.priority === "Hot").length;
  const leadStatusCounts = {
    NEW_INQUIRY: leads.filter((lead) => lead.status === "NEW_INQUIRY").length,
    CONTACTED: leads.filter((lead) => lead.status === "CONTACTED").length,
    QUALIFIED: leads.filter((lead) => lead.status === "QUALIFIED").length,
    CONVERTED: leads.filter((lead) => lead.status === "CONVERTED").length,
  };
  const scheduledVisits = appointments.filter((appointment) => appointment.status === "SCHEDULED").length;
  const completedDeals = deals.filter((deal) => deal.status === "COMPLETED").length;
  const pendingDeals = deals.filter((deal) => deal.status !== "COMPLETED" && deal.status !== "CANCELLED").length;
  const completedDealsList = deals.filter((deal) => deal.status === "COMPLETED");
  const totalSalesVolume = completedDealsList.reduce((sum, deal) => sum + deal.dealValue, 0);
  const commissionAgreements = deals.flatMap((deal) => deal.commissions);
  const legacyCommissions = deals
    .filter((deal) => deal.status !== "CANCELLED" && deal.commissions.length === 0)
    .reduce((sum, deal) => sum + (deal.commissionAmount ?? 0), 0);
  const totalCommission = commissionAgreements.reduce((sum, commission) => sum + commission.totalCommission, 0) + legacyCommissions;
  const commissionOutstanding = commissionAgreements.reduce((sum, commission) => {
    const agencyPaid = commission.payments.reduce((paid, payment) => paid + payment.agencyAmount, 0);
    const agentPaid = commission.payments.reduce((paid, payment) => paid + payment.agentAmount, 0);
    return sum + Math.max(commission.agencyShare - agencyPaid, 0) + Math.max(commission.agentShare - agentPaid, 0);
  }, legacyCommissions);
  const outstandingCustomerPayments = deals.reduce(
    (sum, deal) => deal.status === "CANCELLED"
      ? sum
      : sum + Math.max(deal.remainingBalance ?? deal.dealValue - (deal.bookingAmount ?? 0) - (deal.advancePayment ?? 0), 0),
    0
  );

  const monthlyRevenue = Array.from({ length: 6 }).map((_, index) => {
    const now = new Date();
    const month = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const monthLabel = month.toLocaleString("en-US", { month: "short" });
    const value = dealReceipts
      .filter((payment) => {
        const date = new Date(payment.createdAt);
        return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
      })
      .reduce((sum, payment) => sum + payment.amount, 0);
    return { month: monthLabel, revenue: value };
  });

  const leadConversion = Array.from({ length: 6 }).map((_, index) => {
    const now = new Date();
    const month = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const monthLabel = month.toLocaleString("en-US", { month: "short" });
    const value = leads.filter((lead) => {
      const date = new Date(lead.createdAt);
      return lead.source === "WEBSITE" && date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
    }).length;
    return { month: monthLabel, leads: value };
  });

  const agentPerformance = agents.map((agent) => {
    const leadsForAgent = leads.filter((lead) => lead.assignedAgentId === agent.id);
    const dealsForAgent = deals.filter((deal) => deal.agentId === agent.id && deal.status === "COMPLETED");
    const interactionsForAgent = interactions.filter((interaction) => interaction.agentId === agent.id);
    return {
      name: agent.name,
      leads: leadsForAgent.length,
      calls: interactionsForAgent.filter((interaction) => interaction.type === "CALL").length,
      visits: interactionsForAgent.filter((interaction) => interaction.type === "PROPERTY_VISIT").length,
      conversions: leadsForAgent.filter((lead) => lead.status === "CONVERTED").length,
      revenue: dealsForAgent.reduce((sum, deal) => sum + deal.dealValue, 0),
      conversion: dealsForAgent.length,
    };
  });

  const expenses = entries.filter((entry) => entry.type === "EXPENSE").reduce((sum, entry) => sum + entry.amount, 0);
  const income = entries.filter((entry) => entry.type === "INCOME").reduce((sum, entry) => sum + entry.amount, 0);
  const totalReceived = dealReceipts.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    totalProperties,
    activeProjects,
    totalCustomers,
    newWebsiteInquiries,
    activeLeads,
    leadStatusCounts,
    hotLeads,
    scheduledVisits,
    completedDeals,
    pendingDeals,
    totalSalesVolume,
    totalCommission,
    commissionOutstanding,
    outstandingCustomerPayments,
    totalReceived,
    overdueReminders: overdueReminderCount,
    unreadNotifications: notifications.length,
    reminders: reminders.slice(0, 8),
    notifications,
    monthlyRevenue,
    leadConversion,
    agentPerformance,
    expenses,
    income,
    projects,
    properties,
    canViewCrm,
    leads: leads.slice(0, 8),
    customers: customers.slice(0, 5),
    deals: deals.slice(0, 5),
    appointments: appointments.slice(0, 5),
    recentActivity: interactions.slice(0, 5).map((interaction, index) => ({
      id: `${interaction.agentId}-${interaction.type}-${index}`,
      title: interaction.summary,
      time: interaction.occurredAt.toLocaleDateString(),
      tag: interaction.type.replaceAll("_", " "),
    })).concat(leads.slice(0, 5).map((lead) => ({
      id: lead.id,
      title: `${lead.fullName} submitted a lead`,
      time: new Date(lead.createdAt).toLocaleDateString(),
      tag: lead.status,
    }))).slice(0, 5),
  };
}

export async function getPublicSiteData() {
  const [projects, properties] = await Promise.all([
    prisma.project.findMany({
      where: { featured: true, status: "Active" },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: {
        id: true,
        name: true,
        city: true,
        location: true,
        description: true,
        image: true,
        featured: true,
      },
    }),
    prisma.property.findMany({
      where: { availability: "Available" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        propertyType: true,
        size: true,
        location: true,
        price: true,
        availability: true,
        image: true,
        project: { select: { name: true } },
      },
    }),
  ]);

  return { projects, properties };
}
