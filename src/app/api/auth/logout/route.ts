import { NextResponse } from "next/server";
import { logoutUser, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (user) {
      // Log logout activity
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "LOGOUT",
          details: `Usuário ${user.name} saiu do sistema.`
        }
      });
    }

    await logoutUser();
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const redirectUrl = new URL("/login", `${proto}://${host}`);

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    console.error("Logout API error:", err);
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const redirectUrl = new URL("/login", `${proto}://${host}`);
    return NextResponse.redirect(redirectUrl);
  }
}
