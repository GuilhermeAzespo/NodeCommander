import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getProviderForHypervisor } from "@/lib/providers/factory";
import { notifyActivity } from "@/lib/mail";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ vmId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const { vmId } = await params;
    const { action, hypervisorId } = await req.json();

    if (!action || !hypervisorId) {
      return NextResponse.json(
        { error: "Os parâmetros 'action' e 'hypervisorId' são obrigatórios." },
        { status: 400 }
      );
    }

    // Check permission: Admin, Operator with FULL or CONTROL access
    if (user.role !== "ADMIN") {
      const permission = await prisma.permission.findUnique({
        where: {
          userId_hypervisorId: {
            userId: user.id,
            hypervisorId
          }
        }
      });
      
      const hasAccess = permission && (permission.access === "FULL" || permission.access === "CONTROL");
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Acesso negado. Você precisa de permissão de nível CONTROL ou superior." },
          { status: 403 }
        );
      }
    }

    const provider = await getProviderForHypervisor(hypervisorId);
    let success = false;

    if (action === "START") {
      success = await provider.startVM(vmId);
    } else if (action === "STOP") {
      success = await provider.stopVM(vmId);
    } else if (action === "REBOOT") {
      success = await provider.rebootVM(vmId);
    } else {
      return NextResponse.json(
        { error: "Ação inválida." },
        { status: 400 }
      );
    }

    if (!success) {
      return NextResponse.json(
        { error: `O hipervisor falhou ao executar a ação ${action} na VM.` },
        { status: 500 }
      );
    }

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: `${action}_VM`,
        details: `Executou a ação "${action}" na VM de ID ${vmId}.`
      }
    });

    // Notify admins for stopping or rebooting
    if (action === "STOP" || action === "REBOOT") {
      notifyActivity({
        userName: user.name,
        action: `${action} DE VM`,
        details: `Realizou a ação de ${action} na VM ID ${vmId} no hipervisor.`
      }).catch(err => console.error("Notification alert failed:", err));
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Control VM API error:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao executar ação de controle na máquina virtual." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ vmId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const { vmId } = await params;
    const { searchParams } = new URL(req.url);
    const hypervisorId = searchParams.get("hypervisorId");

    if (!hypervisorId) {
      return NextResponse.json(
        { error: "O parâmetro query hypervisorId é obrigatório." },
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
          { error: "Acesso negado. Permissão de nível FULL é necessária para deletar máquinas virtuais." },
          { status: 403 }
        );
      }
    }

    const provider = await getProviderForHypervisor(hypervisorId);
    const success = await provider.deleteVM(vmId);

    if (!success) {
      return NextResponse.json(
        { error: "O hipervisor falhou ao deletar a máquina virtual." },
        { status: 500 }
      );
    }

    // Clean up any manual IP override for this VM
    try {
      await prisma.vmIPOverride.delete({
        where: {
          hypervisorId_vmId: {
            hypervisorId,
            vmId
          }
        }
      });
    } catch (dbErr) {
      // Ignore if override didn't exist
    }

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "DELETE_VM",
        details: `Deletou a VM de ID ${vmId}.`
      }
    });

    notifyActivity({
      userName: user.name,
      action: "EXCLUSÃO DE VM",
      details: `Deletou permanentemente a VM de ID ${vmId} no hipervisor.`
    }).catch(err => console.error("Notification alert failed:", err));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Delete VM API error:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao deletar a máquina virtual." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ vmId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const { vmId } = await params;
    const { hypervisorId, name, cpu, memory, ipAddress } = await req.json();

    if (!hypervisorId) {
      return NextResponse.json(
        { error: "O parâmetro 'hypervisorId' é obrigatório." },
        { status: 400 }
      );
    }

    // Check permission: Admin or Operator with FULL or CONTROL access
    if (user.role !== "ADMIN") {
      const permission = await prisma.permission.findUnique({
        where: {
          userId_hypervisorId: {
            userId: user.id,
            hypervisorId
          }
        }
      });
      
      const hasAccess = permission && (permission.access === "FULL" || permission.access === "CONTROL");
      if (!hasAccess) {
        return NextResponse.json(
          { error: "Acesso negado. Você precisa de permissão de nível CONTROL ou superior." },
          { status: 403 }
        );
      }
    }

    const provider = await getProviderForHypervisor(hypervisorId);
    
    // Only invoke updateVM if name, cpu, or memory changes are requested
    if (name !== undefined || cpu !== undefined || memory !== undefined) {
      if (!provider.updateVM) {
        return NextResponse.json(
          { error: "Este provedor de hipervisor não suporta edição de hardware de VMs." },
          { status: 400 }
        );
      }

      const success = await provider.updateVM(vmId, { name, cpu, memory });

      if (!success) {
        return NextResponse.json(
          { error: "O hipervisor falhou ao atualizar a configuração da máquina virtual." },
          { status: 500 }
        );
      }
    }

    // Save or clear manual IP override
    if (ipAddress !== undefined) {
      if (ipAddress) {
        await prisma.vmIPOverride.upsert({
          where: {
            hypervisorId_vmId: {
              hypervisorId,
              vmId
            }
          },
          create: {
            hypervisorId,
            vmId,
            ipAddress
          },
          update: {
            ipAddress
          }
        });
      } else {
        try {
          await prisma.vmIPOverride.delete({
            where: {
              hypervisorId_vmId: {
                hypervisorId,
                vmId
              }
            }
          });
        } catch (dbErr) {
          // Ignore if it didn't exist
        }
      }
    }

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "UPDATE_VM_HARDWARE",
        details: `Atualizou o hardware da VM ID ${vmId} (Nome: ${name || "sem alteração"}, CPU: ${cpu || "sem alteração"} cores, RAM: ${memory || "sem alteração"} MB).`
      }
    });

    notifyActivity({
      userName: user.name,
      action: "ALTERAÇÃO DE HARDWARE VM",
      details: `Alterou a configuração da VM ID ${vmId} (Nome: ${name || "n/a"}, CPU: ${cpu || "n/a"}, RAM: ${memory || "n/a"}).`
    }).catch(err => console.error("Notification alert failed:", err));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Update VM Hardware API error:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao atualizar a máquina virtual." },
      { status: 500 }
    );
  }
}
