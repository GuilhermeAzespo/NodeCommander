import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { comparePassword, loginUser } from "@/lib/auth";

// Rate limit na memória (em produção usar Redis/DB)
const rateLimit = new Map<string, { count: number; resetTime: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutos

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    
    // Checa Rate Limit
    const now = Date.now();
    const limit = rateLimit.get(ip);
    if (limit && now < limit.resetTime && limit.count >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Muitas tentativas falhas. Tente novamente em 15 minutos." },
        { status: 429 }
      );
    }

    const registerFailure = () => {
      const current = rateLimit.get(ip) || { count: 0, resetTime: now + LOCKOUT_MS };
      if (now > current.resetTime) {
        current.count = 1;
        current.resetTime = now + LOCKOUT_MS;
      } else {
        current.count += 1;
      }
      rateLimit.set(ip, current);
    };

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-mail e senha são obrigatórios." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      registerFailure();
      return NextResponse.json(
        { error: "Credenciais inválidas." },
        { status: 401 }
      );
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      registerFailure();
      return NextResponse.json(
        { error: "Credenciais inválidas." },
        { status: 401 }
      );
    }

    // Login com sucesso: reseta as tentativas
    rateLimit.delete(ip);

    // Set HttpOnly cookie
    await loginUser(user.id, user.role);

    // Create Activity Log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        details: `Usuário ${user.name} fez login no sistema.`
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
    console.error("Login API error:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
