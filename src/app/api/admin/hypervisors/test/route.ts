import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ProxmoxProvider } from "@/lib/providers/proxmox";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 }
      );
    }

    const { id, type, host, port, username, credential, nodeName } = await req.json();

    let provider: ProxmoxProvider | null = null;

    if (id) {
      // Test existing hypervisor
      const hv = await prisma.hypervisor.findUnique({ where: { id } });
      if (!hv) {
        return NextResponse.json(
          { error: "Hipervisor não encontrado." },
          { status: 404 }
        );
      }
      
      const decryptedCredential = decrypt(hv.credential);
      if (hv.type === "PROXMOX") {
        provider = new ProxmoxProvider(hv.host, hv.port, hv.username, decryptedCredential, hv.nodeName);
      }
    } else {
      // Test unsaved connection parameters
      if (!type || !host || !username || !credential) {
        return NextResponse.json(
          { error: "Dados de conexão insuficientes." },
          { status: 400 }
        );
      }

      if (type === "PROXMOX") {
        provider = new ProxmoxProvider(host, port ? parseInt(port) : 8006, username, credential, nodeName || "pve");
      }
    }

    if (!provider) {
      return NextResponse.json(
        { error: "Tipo de hipervisor ou provedor não suportado." },
        { status: 400 }
      );
    }

    const isConnected = await provider.testConnection();

    // Update the database status if it's an existing node
    if (id) {
      await prisma.hypervisor.update({
        where: { id },
        data: { status: isConnected ? "ONLINE" : "OFFLINE" }
      });
    }

    return NextResponse.json({ success: isConnected });
  } catch (err: any) {
    console.error("Test connection error:", err);
    return NextResponse.json(
      { error: err.message || "Erro durante o teste de conexão." },
      { status: 500 }
    );
  }
}
