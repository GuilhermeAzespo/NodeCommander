import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // Get query param for timeframe (e.g. 24h, 7d)
    const url = new URL(request.url);
    const timeframe = url.searchParams.get("timeframe") || "24h";

    let fromDate = new Date();
    if (timeframe === "24h") {
      fromDate.setHours(fromDate.getHours() - 24);
    } else if (timeframe === "7d") {
      fromDate.setDate(fromDate.getDate() - 7);
    } else {
      fromDate.setHours(fromDate.getHours() - 24); // default
    }

    const metrics = await prisma.clusterMetric.findMany({
      where: {
        timestamp: {
          gte: fromDate
        }
      },
      orderBy: {
        timestamp: "asc"
      }
    });

    return NextResponse.json({ success: true, data: metrics });
  } catch (error: any) {
    console.error("Historical Metrics error:", error);
    return NextResponse.json({ error: "Erro ao obter métricas históricas." }, { status: 500 });
  }
}
