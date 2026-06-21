import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

// GET /api/ssh/sessions — list all sessions (password never returned)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const sessions = await prisma.sshSession.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, host: true, port: true, username: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ sessions });
}

// POST /api/ssh/sessions — create a new session
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json();
  const { name, host, port, username, password } = body;

  if (!name || !host || !username || !password) {
    return NextResponse.json({ error: "Campos obrigatórios: name, host, username, password." }, { status: 400 });
  }

  const session = await prisma.sshSession.create({
    data: {
      name: name.trim(),
      host: host.trim(),
      port: parseInt(port) || 22,
      username: username.trim(),
      password: encrypt(password),
    },
    select: { id: true, name: true, host: true, port: true, username: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ session }, { status: 201 });
}

// PATCH /api/ssh/sessions — update session
export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json();
  const { id, name, host, port, username, password } = body;

  if (!id) return NextResponse.json({ error: "ID da sessão é obrigatório." }, { status: 400 });

  const updateData: any = {};
  if (name)     updateData.name     = name.trim();
  if (host)     updateData.host     = host.trim();
  if (port)     updateData.port     = parseInt(port) || 22;
  if (username) updateData.username = username.trim();
  if (password) updateData.password = encrypt(password);

  const session = await prisma.sshSession.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, host: true, port: true, username: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ session });
}

// DELETE /api/ssh/sessions?id=xxx — delete session
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID é obrigatório." }, { status: 400 });

  await prisma.sshSession.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
