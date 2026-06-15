import React from "react";
import { prisma } from "@/lib/db";
import { getProviderForHypervisor } from "@/lib/providers/factory";
import { 
  Server, 
  Cpu, 
  Terminal, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  User as UserIcon,
  Clock
} from "lucide-react";

// Force dynamic rendering since we are checking real-time statuses and logs
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // 1. Fetch system totals from database
  const totalHypervisors = await prisma.hypervisor.count();
  const onlineHypervisors = await prisma.hypervisor.count({ where: { status: "ONLINE" } });
  const totalUsers = await prisma.user.count();

  // 2. Fetch all online hypervisors to aggregate dynamic VM metrics
  const activeNodes = await prisma.hypervisor.findMany({
    where: { status: "ONLINE" }
  });

  let totalVMs = 0;
  let runningVMs = 0;

  try {
    const vmsPromises = activeNodes.map(async (node) => {
      try {
        const provider = await getProviderForHypervisor(node.id);
        return await provider.listVMs();
      } catch (err) {
        console.error(`Failed to list VMs for node ${node.name} on dashboard load:`, err);
        return [];
      }
    });

    const vmsLists = await Promise.all(vmsPromises);
    const allVMs = vmsLists.flat();
    totalVMs = allVMs.length;
    runningVMs = allVMs.filter((vm) => vm.status === "RUNNING").length;
  } catch (err) {
    console.error("Dashboard VM aggregation failed:", err);
  }

  // 3. Fetch recent audit logs
  const logs = await prisma.activityLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 8,
    include: {
      user: {
        select: {
          name: true,
          email: true,
        }
      }
    }
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Dashboard</h1>
        <p className="text-slate-400 mt-1">Visão consolidada da infraestrutura de virtualização.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Nodes Card */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors p-6 rounded-2xl flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Hipervisores</span>
            <div className="text-3xl font-extrabold text-white">
              {onlineHypervisors}<span className="text-slate-600 text-xl font-normal"> / {totalHypervisors}</span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${onlineHypervisors > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
              {onlineHypervisors} nós online
            </p>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
            <Server className="w-6 h-6" />
          </div>
        </div>

        {/* Total VMs Card */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors p-6 rounded-2xl flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total VMs</span>
            <div className="text-3xl font-extrabold text-white">{totalVMs}</div>
            <p className="text-xs text-slate-500">Máquinas virtuais centralizadas</p>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
            <Cpu className="w-6 h-6" />
          </div>
        </div>

        {/* Running VMs Card */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors p-6 rounded-2xl flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">VMs Ativas</span>
            <div className="text-3xl font-extrabold text-emerald-400">
              {runningVMs}<span className="text-slate-600 text-xl font-normal"> / {totalVMs}</span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${runningVMs > 0 ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
              {runningVMs} operando
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Users Card */}
        <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors p-6 rounded-2xl flex items-center justify-between">
          <div className="space-y-2">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Usuários</span>
            <div className="text-3xl font-extrabold text-white">{totalUsers}</div>
            <p className="text-xs text-slate-500">Contas gerenciadas</p>
          </div>
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
            <UserIcon className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Logs Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl lg:col-span-2 flex flex-col">
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="p-1.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-white text-lg">Registro de Atividades</h2>
              <p className="text-slate-500 text-xs mt-0.5">Últimos eventos e ações auditadas no painel</p>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Nenhum log registrado ainda.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-[10px] uppercase font-bold text-slate-500 tracking-wider bg-slate-950/45 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Hora</th>
                    <th className="px-6 py-3.5">Usuário</th>
                    <th className="px-6 py-3.5">Ação</th>
                    <th className="px-6 py-3.5">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 text-xs text-slate-400 whitespace-nowrap flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {new Date(log.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-6 py-4 text-white font-medium whitespace-nowrap">
                        {log.user ? log.user.name : "Sistema"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.action.includes("CREATE") || log.action.includes("ADD")
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : log.action.includes("DELETE") || log.action.includes("STOP")
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : log.action.includes("LOGIN")
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-300 max-w-xs truncate" title={log.details}>
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Quick Help Card */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <Terminal className="w-5 h-5 text-blue-400" />
              Bem-vindo ao NodeCommander
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              O NodeCommander centraliza múltiplos nós do Proxmox VE (e futuramente VMware ESXi) em um único console. 
            </p>
            <div className="space-y-3 pt-2">
              <div className="flex gap-3 items-start">
                <div className="mt-1 flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold shrink-0">1</div>
                <p className="text-slate-300 text-xs">Vá em <strong>Hipervisores</strong> e adicione seu nó do Proxmox VE. Use o host <code className="bg-slate-950 px-1.5 py-0.5 rounded text-blue-400 text-[10px] font-mono">mock</code> para testar a interface imediatamente.</p>
              </div>
              <div className="flex gap-3 items-start">
                <div className="mt-1 flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold shrink-0">2</div>
                <p className="text-slate-300 text-xs">Navegue até <strong>Máquinas Virtuais</strong> para ver o inventário, ciclo de vida das VMs e criar novas instâncias.</p>
              </div>
              <div className="flex gap-3 items-start">
                <div className="mt-1 flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-semibold shrink-0">3</div>
                <p className="text-slate-300 text-xs">Configure o servidor <strong>SMTP</strong> para habilitar alertas automáticos por e-mail quando ações críticas de energia ou deleções ocorrerem.</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
            <span>Versão Core: v0.1.0</span>
            <span>Ambiente: {process.env.NODE_ENV === "production" ? "Produção" : "Desenvolvimento"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
