import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProviderForHypervisor } from "@/lib/providers/factory";
import { prisma } from "@/lib/db";
import jwt from "jsonwebtoken";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const hypervisor = await prisma.hypervisor.findUnique({
      where: { id: params.id },
    });
    
    if (!hypervisor) {
      return NextResponse.json({ error: "Hipervisor não encontrado." }, { status: 404 });
    }

    const provider = await getProviderForHypervisor(params.id);

    if (!provider.createTermProxy) {
      return NextResponse.json({ error: "O hipervisor não suporta proxy VNC/Terminal." }, { status: 400 });
    }

    // Pass the target node from body if provided (hypervisor could manage multiple nodes)
    const body = await req.json().catch(() => ({}));
    const nodeName = body.node || hypervisor.nodeName;

    const proxyData = await provider.createTermProxy(nodeName);
    if (!proxyData) {
      return NextResponse.json({ error: "Falha ao obter credenciais de terminal do hipervisor." }, { status: 500 });
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
    console.error("Term Proxy Error:", error);
    return NextResponse.json({ error: "Erro interno ao gerar proxy Terminal." }, { status: 500 });
  }
}
