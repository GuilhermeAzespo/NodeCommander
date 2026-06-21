import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProviderForHypervisor } from "@/lib/providers/factory";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; vmId: string; snapName: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { id, vmId, snapName } = await params;
    const body = await request.json();

    if (body.action !== "rollback") {
      return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }

    const provider = await getProviderForHypervisor(id);
    if (!provider.rollbackSnapshot) {
      return NextResponse.json({ error: "Este provedor não suporta rollback de snapshots." }, { status: 400 });
    }

    const success = await provider.rollbackSnapshot(vmId, snapName);
    if (success) {
      return NextResponse.json({ message: "Snapshot restaurado com sucesso." });
    } else {
      return NextResponse.json({ error: "Falha ao restaurar snapshot." }, { status: 500 });
    }
  } catch (err: any) {
    console.error("Rollback Snapshot API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; vmId: string; snapName: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { id, vmId, snapName } = await params;

    const provider = await getProviderForHypervisor(id);
    if (!provider.deleteSnapshot) {
      return NextResponse.json({ error: "Este provedor não suporta exclusão de snapshots." }, { status: 400 });
    }

    const success = await provider.deleteSnapshot(vmId, snapName);
    if (success) {
      return NextResponse.json({ message: "Snapshot excluído com sucesso." });
    } else {
      return NextResponse.json({ error: "Falha ao excluir snapshot." }, { status: 500 });
    }
  } catch (err: any) {
    console.error("Delete Snapshot API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
