import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Cpu, 
  Settings, 
  Users, 
  Mail, 
  LogOut, 
  Terminal 
} from "lucide-react";
import ActiveLink from "./ActiveLink";
import ThemeToggle from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = user.role === "ADMIN";

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-bg-secondary border-b md:border-b-0 md:border-r border-border-color flex flex-col shrink-0">
        {/* Logo Header */}
        <div className="p-6 border-b border-border-color flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-lg">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-text-primary tracking-wide block">NodeCommander</span>
            <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider block">Central v0.1</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1">
          <ActiveLink href="/dashboard">
            <LayoutDashboard className="w-5 h-5" />
            <span>Dashboard</span>
          </ActiveLink>

          <ActiveLink href="/dashboard/vms">
            <Cpu className="w-5 h-5" />
            <span>Máquinas Virtuais</span>
          </ActiveLink>

          <ActiveLink href="/dashboard/hypervisors">
            <Settings className="w-5 h-5" />
            <span>Hipervisores</span>
          </ActiveLink>

          {isAdmin && (
            <>
              <div className="pt-4 pb-2 px-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                Administração
              </div>
              <ActiveLink href="/dashboard/users">
                <Users className="w-5 h-5" />
                <span>Usuários</span>
              </ActiveLink>
              <ActiveLink href="/dashboard/smtp">
                <Mail className="w-5 h-5" />
                <span>Configurações SMTP</span>
              </ActiveLink>
            </>
          )}
        </nav>

        {/* User Footer info */}
        <div className="p-4 border-t border-border-color bg-bg-secondary/50 flex items-center justify-between gap-3">
          <div className="truncate">
            <div className="text-sm font-semibold text-text-primary truncate">{user.name}</div>
            <div className="text-xs text-text-secondary truncate flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-purple-500' : 'bg-blue-500'}`}></span>
              {user.role}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <ThemeToggle />
            <form action="/api/auth/logout" method="POST">
              <button
                type="submit"
                title="Sair do sistema"
                className="p-2.5 bg-bg-primary hover:bg-red-500/10 border border-border-color hover:border-red-500/30 text-text-secondary hover:text-red-500 rounded-xl transition-all cursor-pointer flex items-center justify-center"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
