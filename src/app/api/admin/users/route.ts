import { NextResponse } from "next/server";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        permissions: {
          include: {
            hypervisor: {
              select: {
                id: true,
                name: true,
                type: true,
              }
            }
          }
        }
      }
    });

    return NextResponse.json({ users });
  } catch (err) {
    console.error("List Users API error:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado." },
        { status: 403 }
      );
    }

    const { email, name, password, role, permissions } = await req.json();

    if (!email || !name || !password || !role) {
      return NextResponse.json(
        { error: "Preencha todos os campos obrigatórios." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Este e-mail já está em uso." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Create user and initial scoped permissions
    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        permissions: role !== "ADMIN" && permissions && Array.isArray(permissions) ? {
          create: permissions.map((p: any) => ({
            hypervisorId: p.hypervisorId,
            access: p.access // "FULL", "CONTROL", "VIEW"
          }))
        } : undefined
      }
    });

    await prisma.activityLog.create({
      data: {
        userId: admin.id,
        action: "CREATE_USER",
        details: `Criou o usuário ${name} (${email}) com o papel ${role}.`
      }
    });

    return NextResponse.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role
      }
    });
  } catch (err) {
    console.error("Create User API error:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
