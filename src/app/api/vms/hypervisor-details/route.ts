import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProviderForHypervisor } from "@/lib/providers/factory";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const hypervisorId = searchParams.get("hypervisorId");

    if (!hypervisorId) {
      return NextResponse.json(
        { error: "O parâmetro hypervisorId é obrigatório." },
        { status: 400 }
      );
    }

    // Check scope permissions
    if (user.role !== "ADMIN") {
      const permission = await prisma.permission.findUnique({
        where: {
          userId_hypervisorId: {
            userId: user.id,
            hypervisorId
          }
        }
      });
      if (!permission) {
        return NextResponse.json(
          { error: "Você não possui permissão para acessar este hipervisor." },
          { status: 403 }
        );
      }
    }

    const provider = await getProviderForHypervisor(hypervisorId);

    // Call optional methods listISOs, listStorages and listNodes safely in parallel
    const [isos, storages, nodes] = await Promise.all([
      typeof provider.listISOs === "function"
        ? provider.listISOs().catch((err) => {
            console.error("Failed to list ISOs:", err);
            return [];
          })
        : Promise.resolve([]),
      typeof provider.listStorages === "function"
        ? provider.listStorages().catch((err) => {
            console.error("Failed to list storages:", err);
            return [];
          })
        : Promise.resolve([]),
      typeof provider.listNodes === "function"
        ? provider.listNodes().catch((err) => {
            console.error("Failed to list nodes:", err);
            return [];
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({ isos, storages, nodes });
  } catch (err: any) {
    console.error("Hypervisor details API error:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao consultar detalhes do hipervisor." },
      { status: 500 }
    );
  }
}
