import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    let hypervisors;
    // Admins have access to all hypervisors
    if (user.role === "ADMIN") {
      hypervisors = await prisma.hypervisor.findMany({
        orderBy: { createdAt: "desc" }
      });
    } else {
      // Scoped permissions: Operators and Viewers only see hypervisors they are allowed to
      const permissions = await prisma.permission.findMany({
        where: { userId: user.id },
        include: { hypervisor: true }
      });
      hypervisors = permissions.map(p => p.hypervisor);
    }

    // Sanitize credentials out of output
    const sanitized = hypervisors.map(h => ({
      ...h,
      credential: "[OCULTADO]"
    }));

    return NextResponse.json({ hypervisors: sanitized });
  } catch (err) {
    console.error("List Hypervisors API error:", err);
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

    const { name, type, host, port, username, credential, nodeName } = await req.json();

    if (!name || !type || !host || !username || !credential) {
      return NextResponse.json(
        { error: "Preencha todos os campos obrigatórios." },
        { status: 400 }
      );
    }

    const encryptedCredential = encrypt(credential);

    const newHypervisor = await prisma.hypervisor.create({
      data: {
        name,
        type,
        host,
        port: port ? parseInt(port) : 8006,
        username,
        credential: encryptedCredential,
        nodeName: nodeName || "pve",
        status: "UNKNOWN"
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: admin.id,
        action: "ADD_HYPERVISOR",
        details: `Adicionou o hipervisor ${name} (${type}) com endereço ${host}.`
      }
    });

    return NextResponse.json({
      hypervisor: {
        ...newHypervisor,
        credential: "[OCULTADO]"
      }
    });
  } catch (err) {
    console.error("Create Hypervisor API error:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
