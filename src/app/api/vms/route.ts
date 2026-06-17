import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProviderForHypervisor } from "@/lib/providers/factory";
import { notifyActivity } from "@/lib/mail";

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
    
    // Fetch metrics, nodes, and VMs list in parallel
    const [hostMetrics, vms, nodes, ipOverrides] = await Promise.all([
      provider.getHostMetrics().catch(err => {
        console.error("Failed to load host metrics:", err);
        return { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, uptime: 0 };
      }),
      provider.listVMs().catch(err => {
        console.error("Failed to list VMs:", err);
        return [];
      }),
      typeof provider.listNodes === "function"
        ? provider.listNodes().catch(err => {
            console.error("Failed to list nodes:", err);
            return [];
          })
        : Promise.resolve([]),
      prisma.vmIPOverride.findMany({
        where: { hypervisorId }
      }).catch((err: any) => {
        console.error("Failed to load VM IP overrides:", err);
        return [];
      })
    ]);

    // Map IP overrides to the VMs list
    const overrideMap = new Map(ipOverrides.map((o: any) => [o.vmId, o.ipAddress]));
    const enrichedVms = vms.map((vm: any) => {
      const manualIp = overrideMap.get(vm.id);
      return {
        ...vm,
        ipAddress: manualIp || vm.ipAddress
      };
    });

    return NextResponse.json({ vms: enrichedVms, hostMetrics, nodes });
  } catch (err: any) {
    console.error("List VMs API error:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao consultar o hipervisor." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { hypervisorId, name, cpu, memory, disks, iso, disk, image, node, ipAddress } = body;

    if (!hypervisorId || !name || !cpu || !memory) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes." },
        { status: 400 }
      );
    }

    let resolvedDisks = disks;
    if (!resolvedDisks || !Array.isArray(resolvedDisks) || resolvedDisks.length === 0) {
      if (disk) {
        resolvedDisks = [{ storage: "local-lvm", size: parseInt(disk) }];
      } else {
        return NextResponse.json(
          { error: "Configuração de armazenamento (discos) ausente." },
          { status: 400 }
        );
      }
    }

    const resolvedIso = iso || image || null;

    // Check permission: Admin or Operator with FULL access
    if (user.role !== "ADMIN") {
      const permission = await prisma.permission.findUnique({
        where: {
          userId_hypervisorId: {
            userId: user.id,
            hypervisorId
          }
        }
      });
      if (!permission || permission.access !== "FULL") {
        return NextResponse.json(
          { error: "Acesso negado. Permissão de nível FULL é necessária para criar máquinas virtuais." },
          { status: 403 }
        );
      }
    }

    const provider = await getProviderForHypervisor(hypervisorId);
    const result = await provider.createVM({
      name,
      cpu: parseInt(cpu),
      memory: parseInt(memory),
      iso: resolvedIso,
      disks: resolvedDisks,
      node
    });

    if (!result) {
      return NextResponse.json(
        { error: "O hipervisor falhou ao criar a máquina virtual." },
        { status: 500 }
      );
    }

    // Save manual IP override if specified
    if (typeof result === "string" && ipAddress) {
      await prisma.vmIPOverride.upsert({
        where: {
          hypervisorId_vmId: {
            hypervisorId,
            vmId: result
          }
        },
        create: {
          hypervisorId,
          vmId: result,
          ipAddress
        },
        update: {
          ipAddress
        }
      });
    }

    const diskDetails = resolvedDisks.map((d: any) => `${d.storage}:${d.size}GB`).join(", ");
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "CREATE_VM",
        details: `Criou a VM "${name}" (CPU: ${cpu}, RAM: ${memory} MB, Discos: [${diskDetails}], ISO: ${resolvedIso || "Nenhuma"}) no hipervisor.`
      }
    });

    // Notify administrators via SMTP in background
    notifyActivity({
      userName: user.name,
      action: "CRIAÇÃO DE VM",
      details: `Criou a máquina virtual "${name}" no nó do Proxmox.`
    }).catch(err => console.error("Notification failed:", err));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Create VM API error:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao processar a criação da máquina virtual." },
      { status: 500 }
    );
  }
}
