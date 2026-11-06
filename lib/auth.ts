import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySessionToken } from "@/lib/session";

export const getCurrentUser = cache(async () => {
  await connection();
  const token = (await cookies()).get("session")?.value;
  if (!token) return null;

  const sessionUser = verifySessionToken(token);
  if (!sessionUser) return null;

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) return null;

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
});

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(roles: readonly string[]) {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new Error("You are not authorized to perform this action.");
  }
  return user;
}
