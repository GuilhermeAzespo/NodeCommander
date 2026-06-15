import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ProviderFactory } from "@/lib/providers/provider";
import prisma from "@/lib/prisma";

export async function POST(req: Request, props: { params: Promise<{ vmId: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const hypervisor = await prisma.hypervisor.findFirst();
    if (!hypervisor) {
      return NextResponse.json({ error: "Nenhum hipervisor configurado." }, { status: 404 });
    }

    const provider = ProviderFactory.getProvider(
      hypervisor.type,
      hypervisor.host,
      hypervisor.port,
      hypervisor.username,
      hypervisor.credential,
      hypervisor.nodeName
    );

    if (!provider.createVncProxy) {
      return NextResponse.json({ error: "O hipervisor não suporta proxy VNC." }, { status: 400 });
    }

    const proxyData = await provider.createVncProxy(params.vmId);
    
    if (!proxyData) {
      return NextResponse.json({ error: "Falha ao gerar ticket do VNC no Proxmox." }, { status: 500 });
    }

    return NextResponse.json(proxyData);
  } catch (error) {
    console.error("VNC Proxy Error:", error);
    return NextResponse.json({ error: "Erro interno ao gerar proxy VNC." }, { status: 500 });
  }
}
