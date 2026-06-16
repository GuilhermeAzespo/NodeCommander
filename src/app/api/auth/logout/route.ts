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
    return NextResponse.redirect(new URL("/login", req.url));
  } catch (err) {
    console.error("Logout API error:", err);
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
