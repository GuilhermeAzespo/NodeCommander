import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const templates = await prisma.vmTemplate.findMany({
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ templates });
  } catch (err: any) {
    console.error("GET VM Templates API error:", err);
    return NextResponse.json(
      { error: "Erro ao listar templates de VM." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    // Only Admin and Operator can manage templates
    if (user.role !== "ADMIN" && user.role !== "OPERATOR") {
      return NextResponse.json(
        { error: "Permissão insuficiente para criar templates." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, cpu, memory, disks, iso, node } = body;

    if (!name || !cpu || !memory || !disks) {
      return NextResponse.json(
        { error: "Nome, CPU, Memória e Discos são obrigatórios." },
        { status: 400 }
      );
    }

    // Check if name already exists
    const existing = await prisma.vmTemplate.findUnique({
      where: { name }
    });
    if (existing) {
      return NextResponse.json(
        { error: "Já existe um template com este nome." },
        { status: 400 }
      );
    }

    const template = await prisma.vmTemplate.create({
      data: {
        name,
        cpu: parseInt(cpu),
        memory: parseInt(memory),
        disks: JSON.stringify(disks),
        iso: iso || null,
        node: node || null
      }
    });

    return NextResponse.json({ success: true, template });
  } catch (err: any) {
    console.error("POST VM Template API error:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao salvar template de VM." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    // Only Admin and Operator can manage templates
    if (user.role !== "ADMIN" && user.role !== "OPERATOR") {
      return NextResponse.json(
        { error: "Permissão insuficiente para excluir templates." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "O parâmetro id é obrigatório." },
        { status: 400 }
      );
    }

    await prisma.vmTemplate.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE VM Template API error:", err);
    return NextResponse.json(
      { error: "Erro ao excluir template de VM." },
      { status: 500 }
    );
  }
}
