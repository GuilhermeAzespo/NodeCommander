import nodemailer from "nodemailer";
import { prisma } from "./db";
import { decrypt } from "./crypto";

interface SMTPConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
  from: string;
  secure: boolean;
}

// Fetch SMTP settings dynamically from DB
async function getSMTPConfig(): Promise<SMTPConfig | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { id: "smtp_config" }
    });
    if (!setting) return null;
    
    const parsed = JSON.parse(setting.value) as SMTPConfig;
    // Decrypt password if present
    if (parsed.password) {
      parsed.password = decrypt(parsed.password);
    }
    return parsed;
  } catch (err) {
    console.error("Failed to load SMTP config:", err);
    return null;
  }
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const config = await getSMTPConfig();
  
  if (!config || !config.host || !config.user) {
    console.warn("SMTP is not fully configured. Email was not sent. Logged text:", text);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure, // true for 465, false for other ports
      auth: {
        user: config.user,
        pass: config.password || "",
      },
      tls: {
        rejectUnauthorized: false, // Avoid self-signed certificate issues on local mail servers
      }
    });

    await transporter.sendMail({
      from: `"${config.from.split("@")[0]}" <${config.from}>`,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, "<br>"),
    });

    return true;
  } catch (err) {
    console.error("Failed to send email via SMTP:", err);
    return false;
  }
}

export async function notifyActivity({
  userName,
  action,
  details,
}: {
  userName: string;
  action: string;
  details: string;
}): Promise<void> {
  const subject = `[NodeCommander] Alerta de Atividade: ${action}`;
  const text = `Olá,
  
Uma nova atividade crítica foi realizada no NodeCommander:

Usuário: ${userName}
Ação: ${action}
Detalhes: ${details}
Data/Hora: ${new Date().toLocaleString("pt-BR")}

Este é um e-mail de notificação automática.`;

  // We can send to a system administrator email, or look up all ADMIN users in the DB
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" }
    });

    for (const admin of admins) {
      await sendEmail({
        to: admin.email,
        subject,
        text,
      });
    }
  } catch (err) {
    console.error("Failed to dispatch activity emails to admins:", err);
  }
}
