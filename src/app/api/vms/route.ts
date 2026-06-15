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
    
    // Fetch metrics and VMs list in parallel
    const [hostMetrics, vms] = await Promise.all([
      provider.getHostMetrics().catch(err => {
        console.error("Failed to load host metrics:", err);
        return { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, uptime: 0 };
      }),
      provider.listVMs().catch(err => {
        console.error("Failed to list VMs:", err);
        return [];
      })
    ]);

    return NextResponse.json({ vms, hostMetrics });
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

    const { hypervisorId, name, cpu, memory, disk, image } = await req.json();

    if (!hypervisorId || !name || !cpu || !memory || !disk) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes." },
        { status: 400 }
      );
    }

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
    const success = await provider.createVM({
      name,
      cpu: parseInt(cpu),
      memory: parseInt(memory),
      disk: parseInt(disk),
      image: image || ""
    });

    if (!success) {
      return NextResponse.json(
        { error: "O hipervisor falhou ao criar a máquina virtual." },
        { status: 500 }
      );
    }

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "CREATE_VM",
        details: `Criou a VM "${name}" (CPU: ${cpu}, RAM: ${memory} MB, Disco: ${disk} GB) no hipervisor.`
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
