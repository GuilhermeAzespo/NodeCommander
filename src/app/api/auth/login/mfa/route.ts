import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken, loginUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { authenticator } from "otplib";
import { decrypt } from "@/lib/crypto";

export async function POST(req: Request) {
  try {
    const { code } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Código é obrigatório." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const pendingToken = cookieStore.get("nodecommander_mfa_pending")?.value;

    if (!pendingToken) {
      return NextResponse.json({ error: "Sessão de MFA expirada ou inválida." }, { status: 401 });
    }

    const payload = verifyToken(pendingToken);
    if (!payload) {
      return NextResponse.json({ error: "Token temporário inválido." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (!user || !user.mfaSecret) {
      return NextResponse.json({ error: "Usuário ou configuração MFA inválida." }, { status: 401 });
    }

    const secret = decrypt(user.mfaSecret);
    const isValid = authenticator.verify({ token: code, secret });

    if (!isValid) {
      return NextResponse.json({ error: "Código incorreto." }, { status: 400 });
    }

    // Código válido! Apagar cookie temporário e fazer login de verdade
    cookieStore.delete("nodecommander_mfa_pending");
    await loginUser(user.id, user.role);

    // Create Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        details: `Usuário ${user.name} fez login com 2FA no sistema.`
      }
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error("MFA Login error:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
