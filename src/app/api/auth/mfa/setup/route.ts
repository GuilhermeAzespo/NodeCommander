import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { encrypt } from "@/lib/crypto";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    // Gerar novo secret
    const secret = authenticator.generateSecret();
    const serviceName = "NodeCommander";
    const otpauth = authenticator.keyuri(user.email, serviceName, secret);

    // Gerar Imagem do QR Code em Base64
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

    // Salva o segredo no banco temporariamente com mfaEnabled = false
    // Criptografamos o secret no banco para segurança
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaSecret: encrypt(secret),
        mfaEnabled: false,
      },
    });

    return NextResponse.json({
      secret, // Para quem não conseguir ler o QR Code
      qrCode: qrCodeDataUrl,
    });
  } catch (err) {
    console.error("MFA Setup Error:", err);
    return NextResponse.json(
      { error: "Erro interno ao configurar MFA" },
      { status: 500 }
    );
  }
}
