import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import jwt from "jsonwebtoken";

// POST /api/ssh/token — generate a short-lived JWT to authenticate the SSH WebSocket
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json();
  const { sessionId } = body;
  if (!sessionId) return NextResponse.json({ error: "sessionId é obrigatório." }, { status: 400 });

  // Verify session exists
  const session = await prisma.sshSession.findUnique({ where: { id: sessionId } });
  if (!session) return NextResponse.json({ error: "Sessão SSH não encontrada." }, { status: 404 });

  const jwtSecret = process.env.JWT_SECRET || "default_node_commander_secret";
  const authToken = jwt.sign(
    { userId: user.id, sessionId, purpose: "ssh" },
    jwtSecret,
    { expiresIn: "1h" }
  );

  return NextResponse.json({ authToken });
}
