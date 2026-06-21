import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProviderForHypervisor } from "@/lib/providers/factory";

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
    if (user.role === "ADMIN") {
      hypervisors = await prisma.hypervisor.findMany({
        orderBy: { createdAt: "desc" }
      });
    } else {
      const permissions = await prisma.permission.findMany({
        where: { userId: user.id },
        include: { hypervisor: true }
      });
      hypervisors = permissions.map(p => p.hypervisor);
    }

    // Fetch metrics in parallel
    const results = await Promise.all(
      hypervisors.map(async (h) => {
        try {
          const provider = await getProviderForHypervisor(h.id);
          const metrics = await provider.getHostMetrics();
          return {
            id: h.id,
            name: h.name,
            type: h.type,
            host: h.host,
            status: "online",
            cpuUsage: metrics.cpuUsage,
            memoryUsage: metrics.memoryUsage,
          };
        } catch (err) {
          console.error(`Failed to get metrics for hypervisor ${h.name}:`, err);
          return {
            id: h.id,
            name: h.name,
            type: h.type,
            host: h.host,
            status: "offline",
            cpuUsage: 0,
            memoryUsage: 0,
          };
        }
      })
    );

    return NextResponse.json({ hypervisors: results });
  } catch (err: any) {
    console.error("List Hypervisors Metrics API error:", err);
    return NextResponse.json(
      { error: "Erro ao obter métricas dos hipervisores." },
      { status: 500 }
    );
  }
}
