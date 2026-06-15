import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { name, host, port, username, credential, nodeName, status } = await req.json();

    const hypervisor = await prisma.hypervisor.findUnique({
      where: { id }
    });

    if (!hypervisor) {
      return NextResponse.json(
        { error: "Hipervisor não encontrado." },
        { status: 404 }
      );
    }

    const data: any = {};
    if (name) data.name = name;
    if (host) data.host = host;
    if (port !== undefined) data.port = parseInt(port);
    if (username) data.username = username;
    if (nodeName) data.nodeName = nodeName;
    if (status) data.status = status;
    if (credential && credential !== "[OCULTADO]") {
      data.credential = encrypt(credential);
    }

    await prisma.hypervisor.update({
      where: { id },
      data
    });

    await prisma.activityLog.create({
      data: {
        userId: admin.id,
        action: "UPDATE_HYPERVISOR",
        details: `Atualizou as configurações do hipervisor ${hypervisor.name}.`
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update Hypervisor API error:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const hypervisor = await prisma.hypervisor.findUnique({
      where: { id }
    });

    if (!hypervisor) {
      return NextResponse.json(
        { error: "Hipervisor não encontrado." },
        { status: 404 }
      );
    }

    await prisma.hypervisor.delete({
      where: { id }
    });

    await prisma.activityLog.create({
      data: {
        userId: admin.id,
        action: "DELETE_HYPERVISOR",
        details: `Deletou o hipervisor ${hypervisor.name} (${hypervisor.type}).`
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete Hypervisor API error:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
