import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getProviderForHypervisor } from "@/lib/providers/factory";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // Basic security check (must have the internal token)
    const token = request.headers.get("x-internal-token");
    const validToken = process.env.INTERNAL_CRON_TOKEN || "nodecommander_cron_secret";
    
    if (token !== validToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all online hypervisors
    const activeNodes = await prisma.hypervisor.findMany({
      where: { status: "ONLINE" }
    });

    if (activeNodes.length === 0) {
      return NextResponse.json({ message: "No active nodes to collect metrics from." });
    }

    let totalCpuUsage = 0;
    let totalMemUsage = 0;
    let totalVMs = 0;
    let runningVMs = 0;
    let successCount = 0;

    const promises = activeNodes.map(async (node) => {
      try {
        const provider = await getProviderForHypervisor(node.id);
        
        // 1. Get Host Metrics
        const metrics = await provider.getHostMetrics();
        
        // 2. Get VMs
        const vms = await provider.listVMs();
        
        return {
          success: true,
          cpuUsage: metrics.cpuUsage,
          memUsage: metrics.memoryUsage,
          totalVms: vms.length,
          runningVms: vms.filter(v => v.status === "RUNNING").length
        };
      } catch (err) {
        console.error(`Collector failed for node ${node.name}:`, err);
        return { success: false };
      }
    });

    const results = await Promise.all(promises);

    for (const res of results) {
      if (res.success) {
        totalCpuUsage += res.cpuUsage!;
        totalMemUsage += res.memUsage!;
        totalVMs += res.totalVms!;
        runningVMs += res.runningVms!;
        successCount++;
      }
    }

    if (successCount === 0) {
      return NextResponse.json({ error: "Failed to collect from any nodes." }, { status: 500 });
    }

    // Average CPU and Memory across successful nodes
    const avgCpu = Number((totalCpuUsage / successCount).toFixed(2));
    const avgMem = Number((totalMemUsage / successCount).toFixed(2));

    // Save to DB
    const metric = await prisma.clusterMetric.create({
      data: {
        cpuUsage: avgCpu,
        memUsage: avgMem,
        totalVMs,
        runningVMs
      }
    });

    // Cleanup: Keep only last 7 days of metrics
    // 7 days * 24 hours * 4 (every 15 min) = ~672 records max
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    await prisma.clusterMetric.deleteMany({
      where: {
        timestamp: {
          lt: sevenDaysAgo
        }
      }
    });

    return NextResponse.json({ success: true, data: metric });

  } catch (error: any) {
    console.error("Metrics Collector error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
