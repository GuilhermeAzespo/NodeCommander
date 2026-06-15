import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProviderForHypervisor } from "@/lib/providers/factory";
import { prisma } from "@/lib/db";
import jwt from "jsonwebtoken";

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

    const provider = await getProviderForHypervisor(hypervisor.id);

    if (!provider.createVncProxy) {
      return NextResponse.json({ error: "O hipervisor não suporta proxy VNC." }, { status: 400 });
    }

    const proxyData = await provider.createVncProxy(params.vmId);
    if (!proxyData) {
      return NextResponse.json({ error: "Falha ao obter credenciais VNC do hipervisor." }, { status: 500 });
    }

    let proxyAuthToken = "";
    if (provider.getAuthHeaders) {
      const authHeaders = await provider.getAuthHeaders();
      const jwtSecret = process.env.JWT_SECRET || "default_node_commander_secret";
      proxyAuthToken = jwt.sign({ authHeaders }, jwtSecret, { expiresIn: '1m' });
    }

    return NextResponse.json({
      ...proxyData,
      proxyAuthToken
    });
  } catch (error) {
    console.error("VNC Proxy Error:", error);
    return NextResponse.json({ error: "Erro interno ao gerar proxy VNC." }, { status: 500 });
  }
}
