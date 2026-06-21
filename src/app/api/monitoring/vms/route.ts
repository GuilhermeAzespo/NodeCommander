import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProviderForHypervisor } from "@/lib/providers/factory";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    // 1. Fetch all hypervisors
    const allHypervisors = await prisma.hypervisor.findMany();

    // 2. Filter hypervisors based on user permissions
    let authorizedHypervisors = [];
    const permissionMap = new Map<string, string>();

    if (user.role === "ADMIN") {
      authorizedHypervisors = allHypervisors;
      allHypervisors.forEach(hv => permissionMap.set(hv.id, "FULL"));
    } else {
      const permissions = await prisma.permission.findMany({
        where: { userId: user.id }
      });
      const allowedIds = new Set(permissions.map(p => p.hypervisorId));
      authorizedHypervisors = allHypervisors.filter(hv => allowedIds.has(hv.id));
      permissions.forEach(p => permissionMap.set(p.hypervisorId, p.access));
    }

    // 3. Query all authorized hypervisors in parallel, handling failures gracefully
    const promises = authorizedHypervisors.map(async (hv) => {
      try {
        const provider = await getProviderForHypervisor(hv.id);
        const [vms, ipOverrides] = await Promise.all([
          provider.listVMs(),
          prisma.vmIPOverride.findMany({
            where: { hypervisorId: hv.id }
          }).catch(() => [])
        ]);

        const overrideMap = new Map(ipOverrides.map(o => [o.vmId, o.ipAddress]));
        return vms.map(vm => ({
          ...vm,
          ipAddress: overrideMap.get(vm.id) || vm.ipAddress,
          hypervisorId: hv.id,
          hypervisorName: hv.name,
          userAccess: permissionMap.get(hv.id) || "VIEW"
        }));
      } catch (err) {
        console.error(`Failed to load VMs for hypervisor ${hv.name} (${hv.id}):`, err);
        return [];
      }
    });

    const results = await Promise.allSettled(promises);
    const aggregatedVMs = results.flatMap((res) => {
      if (res.status === "fulfilled") {
        return res.value;
      }
      return [];
    });

    return NextResponse.json({
      vms: aggregatedVMs,
      userRole: user.role
    });
  } catch (err: any) {
    console.error("Monitoring VMs API error:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao consultar recursos." },
      { status: 500 }
    );
  }
}
