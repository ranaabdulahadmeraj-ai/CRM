import { prisma } from "@/lib/prisma";
import { createSessionToken } from "@/lib/session";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const payload = loginSchema.safeParse(await request.json());
    if (!payload.success) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: payload.data.email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const validPassword = await bcrypt.compare(payload.data.password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });

    response.cookies.set("session", createSessionToken({
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

    return response;
  } catch (error) {
    console.error("Login failed", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
