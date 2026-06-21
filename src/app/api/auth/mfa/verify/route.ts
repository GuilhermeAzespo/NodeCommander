import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authenticator } from "otplib";
import { decrypt } from "@/lib/crypto";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "Código é obrigatório" }, { status: 400 });
    }

    // Buscar o segredo atual do banco
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser || !dbUser.mfaSecret) {
      return NextResponse.json({ error: "MFA não configurado." }, { status: 400 });
    }

    const secret = decrypt(dbUser.mfaSecret);

    const isValid = authenticator.verify({
      token: code,
      secret: secret,
    });

    if (!isValid) {
      return NextResponse.json({ error: "Código inválido" }, { status: 400 });
    }

    // Ativa de fato
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaEnabled: true },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("MFA Verify Error:", err);
    return NextResponse.json(
      { error: "Erro interno ao validar código MFA" },
      { status: 500 }
    );
  }
}
