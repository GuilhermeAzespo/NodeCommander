import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const adSetting = await prisma.systemSetting.findUnique({ where: { key: "auth_ad_config" } });
    const googleSetting = await prisma.systemSetting.findUnique({ where: { key: "auth_google_config" } });
    const m365Setting = await prisma.systemSetting.findUnique({ where: { key: "auth_m365_config" } });

    const parseConfig = (setting: any) => {
      if (!setting) return null;
      try {
        const parsed = JSON.parse(setting.value);
        // Mask passwords/secrets before sending to frontend
        if (parsed.password) parsed.password = "********";
        if (parsed.clientSecret) parsed.clientSecret = "********";
        return parsed;
      } catch {
        return null;
      }
    };

    return NextResponse.json({
      ad: parseConfig(adSetting),
      google: parseConfig(googleSetting),
      m365: parseConfig(m365Setting),
    });
  } catch (error: any) {
    console.error("Auth Settings GET Error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const { type, config } = body;

    if (!type || !config) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    let key = "";
    if (type === "AD") key = "auth_ad_config";
    else if (type === "GOOGLE") key = "auth_google_config";
    else if (type === "M365") key = "auth_m365_config";
    else return NextResponse.json({ error: "Tipo de integração inválido" }, { status: 400 });

    // Se a senha estiver mascarada, significa que o frontend não alterou, então precisamos preservar a original
    if (config.password === "********" || config.clientSecret === "********") {
      const existing = await prisma.systemSetting.findUnique({ where: { key } });
      if (existing) {
        try {
          const parsed = JSON.parse(existing.value);
          if (config.password === "********") config.password = parsed.password;
          if (config.clientSecret === "********") config.clientSecret = parsed.clientSecret;
        } catch (e) {}
      }
    }

    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(config) },
      create: { id: key, key, value: JSON.stringify(config) },
    });

    // Log the action
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_AUTH",
        details: `Atualizou configurações de integração ${type}`,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Auth Settings POST Error:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
