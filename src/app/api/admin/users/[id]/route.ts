import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const { email, name, password, role, permissions } = await req.json();

    const userToUpdate = await prisma.user.findUnique({
      where: { id }
    });

    if (!userToUpdate) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    const data: any = {};
    if (email) data.email = email;
    if (name) data.name = name;
    if (role) data.role = role;
    if (password) {
      data.passwordHash = await hashPassword(password);
    }

    // Wrap the changes in a Prisma Transaction
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data
      });

      if (permissions && Array.isArray(permissions)) {
        // Clear current permissions
        await tx.permission.deleteMany({
          where: { userId: id }
        });

        // Recreate new permissions if user is not ADMIN (ADMIN has access to everything)
        if (role !== "ADMIN") {
          await tx.permission.createMany({
            data: permissions.map((p: any) => ({
              userId: id,
              hypervisorId: p.hypervisorId,
              access: p.access
            }))
          });
        }
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: admin.id,
        action: "UPDATE_USER",
        details: `Atualizou o cadastro do usuário ${userToUpdate.name} (${userToUpdate.email}).`
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update User API error:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 }
      );
    }

    const { id } = await params;

    if (id === admin.id) {
      return NextResponse.json(
        { error: "Você não pode deletar a sua própria conta." },
        { status: 400 }
      );
    }

    const userToDelete = await prisma.user.findUnique({
      where: { id }
    });

    if (!userToDelete) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    await prisma.user.delete({
      where: { id }
    });

    await prisma.activityLog.create({
      data: {
        userId: admin.id,
        action: "DELETE_USER",
        details: `Deletou o usuário ${userToDelete.name} (${userToDelete.email}).`
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete User API error:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
