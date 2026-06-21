import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { 
        mfaEnabled: false,
        mfaSecret: null
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("MFA Disable Error:", err);
    return NextResponse.json(
      { error: "Erro interno ao desativar MFA" },
      { status: 500 }
    );
  }
}
