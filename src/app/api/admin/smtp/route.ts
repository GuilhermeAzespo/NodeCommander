import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import nodemailer from "nodemailer";

export async function GET() {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 }
      );
    }

    const setting = await prisma.systemSetting.findUnique({
      where: { id: "smtp_config" }
    });

    if (!setting) {
      return NextResponse.json({ config: null });
    }

    const config = JSON.parse(setting.value);
    if (config.password) {
      config.password = "[OCULTADO]";
    }

    return NextResponse.json({ config });
  } catch (err) {
    console.error("GET SMTP API error:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { host, port, user, password, from, secure } = body;

    let finalPassword = "";
    if (password && password !== "[OCULTADO]") {
      finalPassword = encrypt(password);
    } else {
      // Retrieve existing password
      const existing = await prisma.systemSetting.findUnique({ where: { id: "smtp_config" } });
      if (existing) {
        const parsed = JSON.parse(existing.value);
        finalPassword = parsed.password || "";
      }
    }

    const smtpConfig = {
      host,
      port: port ? parseInt(port) : 587,
      user,
      password: finalPassword,
      from,
      secure: !!secure
    };

    await prisma.systemSetting.upsert({
      where: { id: "smtp_config" },
      create: {
        id: "smtp_config",
        key: "smtp_config",
        value: JSON.stringify(smtpConfig)
      },
      update: {
        value: JSON.stringify(smtpConfig)
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: admin.id,
        action: "UPDATE_SMTP",
        details: "Atualizou as configurações de envio de e-mail (SMTP)."
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST SMTP API error:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 }
      );
    }

    const { host, port, user, password, from, secure, testEmail } = await req.json();

    if (!host || !user || !from || !testEmail) {
      return NextResponse.json(
        { error: "Dados obrigatórios de teste ausentes." },
        { status: 400 }
      );
    }

    let finalPassword = password;
    if (password === "[OCULTADO]") {
      const existing = await prisma.systemSetting.findUnique({ where: { id: "smtp_config" } });
      if (existing) {
        const parsed = JSON.parse(existing.value);
        finalPassword = decrypt(parsed.password || "");
      }
    }

    const transporter = nodemailer.createTransport({
      host,
      port: port ? parseInt(port) : 587,
      secure: !!secure,
      auth: {
        user,
        pass: finalPassword || ""
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.sendMail({
      from: `"${from.split("@")[0]}" <${from}>`,
      to: testEmail,
      subject: "[NodeCommander] Teste de Configuração SMTP",
      text: `Olá! Este é um e-mail de teste enviado pelo NodeCommander às ${new Date().toLocaleString("pt-BR")}.\n\nSe você recebeu este e-mail, as configurações de disparo de e-mail foram validadas com sucesso.`
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Test SMTP error:", err);
    return NextResponse.json(
      { error: err.message || "Erro no envio de e-mail de teste." },
      { status: 500 }
    );
  }
}
