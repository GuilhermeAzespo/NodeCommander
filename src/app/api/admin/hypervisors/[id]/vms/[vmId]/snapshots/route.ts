import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProviderForHypervisor } from "@/lib/providers/factory";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; vmId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { id, vmId } = await params;
    const provider = await getProviderForHypervisor(id);
    if (!provider.listSnapshots) {
      return NextResponse.json({ error: "Este provedor não suporta snapshots." }, { status: 400 });
    }

    const snapshots = await provider.listSnapshots(vmId);
    return NextResponse.json({ snapshots });
  } catch (err: any) {
    console.error("List Snapshots API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; vmId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

    const { id, vmId } = await params;
    const body = await request.json();
    const { name, description, vmstate } = body;

    if (!name) return NextResponse.json({ error: "Nome do snapshot é obrigatório." }, { status: 400 });

    const provider = await getProviderForHypervisor(id);
    if (!provider.createSnapshot) {
      return NextResponse.json({ error: "Este provedor não suporta criação de snapshots." }, { status: 400 });
    }

    const success = await provider.createSnapshot(vmId, name, description, vmstate);
    if (success) {
      return NextResponse.json({ message: "Snapshot criado com sucesso." });
    } else {
      return NextResponse.json({ error: "Falha ao criar snapshot." }, { status: 500 });
    }
  } catch (err: any) {
    console.error("Create Snapshot API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
