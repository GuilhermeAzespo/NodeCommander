"use client";
import React, { useState, useEffect } from "react";
import { 
  Cpu, 
  Play, 
  Square, 
  RotateCw, 
  Trash2, 
  Plus, 
  Search, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Server, 
  Activity, 
  HardDrive, 
  Database,
  Clock,
  ExternalLink,
  ChevronRight,
  Sparkles
} from "lucide-react";

interface VM {
  id: string;
  name: string;
  status: "RUNNING" | "STOPPED" | "PAUSED" | "UNKNOWN";
  cpu: number;
  memory: number; // MB
  disk: number;   // GB
  ipAddress?: string;
}

interface HostMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  uptime: number;
}

interface Hypervisor {
  id: string;
  name: string;
  type: string;
  host: string;
  status: string;
}

export default function VMsPage() {
  const [hypervisors, setHypervisors] = useState<Hypervisor[]>([]);
  const [selectedHvId, setSelectedHvId] = useState("");
  const [vms, setVms] = useState<VM[]>([]);
  const [hostMetrics, setHostMetrics] = useState<HostMetrics | null>(null);
  
  const [loadingHypervisors, setLoadingHypervisors] = useState(true);
  const [loadingVms, setLoadingVms] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // VM Wizard Form States
  const [vmName, setVmName] = useState("");
  const [vmCpu, setVmCpu] = useState(2);
  const [vmMemory, setVmMemory] = useState(2048);
  const [vmDisk, setVmDisk] = useState(40);
  const [vmImage, setVmImage] = useState("debian-12-standard_amd64.tar.zst");
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardLoading, setWizardLoading] = useState(false);

  useEffect(() => {
    fetchHypervisors();
  }, []);

  useEffect(() => {
    if (selectedHvId) {
      fetchVMs(selectedHvId);
    } else {
      setVms([]);
      setHostMetrics(null);
    }
  }, [selectedHvId]);

  const fetchHypervisors = async () => {
    setLoadingHypervisors(true);
    try {
      const res = await fetch("/api/admin/hypervisors");
      const data = await res.json();
      if (res.ok) {
        setHypervisors(data.hypervisors || []);
        if (data.hypervisors?.length > 0) {
          // Auto select first hypervisor
          setSelectedHvId(data.hypervisors[0].id);
        }
      }
    } catch (err) {
      setError("Falha ao carregar lista de hipervisores.");
    } finally {
      setLoadingHypervisors(false);
    }
  };

  const fetchVMs = async (hvId: string) => {
    setLoadingVms(true);
    setError("");
    try {
      const res = await fetch(`/api/vms?hypervisorId=${hvId}`);
      const data = await res.json();
      if (res.ok) {
        setVms(data.vms || []);
        setHostMetrics(data.hostMetrics || null);
      } else {
        setError(data.error || "Erro ao listar máquinas virtuais.");
      }
    } catch (err) {
      setError("Erro ao carregar inventário de máquinas virtuais.");
    } finally {
      setLoadingVms(false);
    }
  };

  const handleVMAction = async (vmId: string, action: "START" | "STOP" | "REBOOT") => {
    setActionLoadingId(vmId);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/vms/${vmId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, hypervisorId: selectedHvId })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(`Ação ${action} enviada com sucesso para a VM ID ${vmId}.`);
        fetchVMs(selectedHvId); // reload status
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(data.error || "Falha ao executar ação na VM.");
      }
    } catch (err) {
      setError("Erro de comunicação com o servidor.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteVM = async (vmId: string) => {
    if (!confirm("Deseja deletar permanentemente esta VM? Esta ação removerá todos os dados do disco!")) {
      return;
    }

    setActionLoadingId(vmId);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/vms/${vmId}?hypervisorId=${selectedHvId}`, {
        method: "DELETE"
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(`Máquina virtual deletada com sucesso.`);
        fetchVMs(selectedHvId);
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(data.error || "Erro ao deletar máquina virtual.");
      }
    } catch (err) {
      setError("Erro ao solicitar exclusão.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreateVM = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setWizardLoading(true);

    try {
      const res = await fetch("/api/vms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hypervisorId: selectedHvId,
          name: vmName,
          cpu: vmCpu,
          memory: vmMemory,
          disk: vmDisk,
          image: vmImage
        })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(`Máquina virtual "${vmName}" criada com sucesso!`);
        setWizardOpen(false);
        fetchVMs(selectedHvId);
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(data.error || "Falha ao criar máquina virtual.");
      }
    } catch (err) {
      setError("Erro de rede ao provisionar VM.");
    } finally {
      setWizardLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getUsageColorClass = (usage: number) => {
    if (usage < 70) return "bg-emerald-500";
    if (usage < 90) return "bg-amber-500";
    return "bg-rose-500";
  };

  const filteredVMs = vms.filter(
    (vm) =>
      vm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vm.id.includes(searchQuery)
  );

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Máquinas Virtuais</h1>
          <p className="text-slate-400 mt-1">Monitore e gerencie o ciclo de vida das instâncias centralizadas.</p>
        </div>
        {selectedHvId && (
          <button
            onClick={() => {
              setVmName("");
              setWizardStep(1);
              setWizardOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-medium transition-colors cursor-pointer shadow-lg shadow-blue-900/30 shrink-0"
          >
            <Plus className="w-5 h-5" />
            <span>Nova Máquina Virtual</span>
          </button>
        )}
      </div>

      {/* Notices */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl flex items-start gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Selector dropdown and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-4 border border-slate-800 rounded-2xl">
        <div className="flex items-center gap-3 w-full md:max-w-xs">
          <Server className="w-5 h-5 text-slate-500 shrink-0" />
          {loadingHypervisors ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          ) : (
            <select
              value={selectedHvId}
              onChange={(e) => setSelectedHvId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">Selecione um Hipervisor...</option>
              {hypervisors.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name} ({h.type} - {h.status})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
          <input
            type="text"
            disabled={!selectedHvId}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou ID da máquina..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-700 text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
          />
        </div>
      </div>

      {/* Main content grid */}
      {!selectedHvId ? (
        <div className="py-20 text-center bg-slate-900/40 border border-slate-900 rounded-2xl">
          <Server className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-white font-bold text-lg">Nenhum hipervisor selecionado</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
            Por favor, selecione um hipervisor no menu acima para carregar o painel de recursos e as máquinas virtuais.
          </p>
        </div>
      ) : loadingVms ? (
        <div className="py-32 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-slate-400 text-sm">Consultando inventário de recursos...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Host Metrics Panel */}
          {hostMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-900/60 backdrop-blur-md p-6 border border-slate-800 rounded-2xl">
              {/* CPU Meter */}
              <div className="space-y-3">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-400" />
                  CPU Host
                </span>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-black text-white">{hostMetrics.cpuUsage}%</span>
                  <span className="text-slate-600 text-xs font-semibold">Uso</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-850">
                  <div 
                    className={`h-full transition-all duration-500 ${getUsageColorClass(hostMetrics.cpuUsage)}`}
                    style={{ width: `${hostMetrics.cpuUsage}%` }}
                  ></div>
                </div>
              </div>

              {/* Memory Meter */}
              <div className="space-y-3">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                  RAM Host
                </span>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-black text-white">{hostMetrics.memoryUsage}%</span>
                  <span className="text-slate-600 text-xs font-semibold">Uso</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-850">
                  <div 
                    className={`h-full transition-all duration-500 ${getUsageColorClass(hostMetrics.memoryUsage)}`}
                    style={{ width: `${hostMetrics.memoryUsage}%` }}
                  ></div>
                </div>
              </div>

              {/* Storage Meter */}
              <div className="space-y-3">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-purple-400" />
                  Disco Host
                </span>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-black text-white">{hostMetrics.diskUsage}%</span>
                  <span className="text-slate-600 text-xs font-semibold">Uso</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-850">
                  <div 
                    className={`h-full transition-all duration-500 ${getUsageColorClass(hostMetrics.diskUsage)}`}
                    style={{ width: `${hostMetrics.diskUsage}%` }}
                  ></div>
                </div>
              </div>

              {/* Node Uptime */}
              <div className="space-y-2 flex flex-col justify-center pl-0 md:pl-6 border-t md:border-t-0 md:border-l border-slate-800">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Uptime do Host
                </span>
                <span className="text-lg font-bold text-slate-200">
                  {formatUptime(hostMetrics.uptime)}
                </span>
                <span className="text-[10px] text-slate-500">Node status online</span>
              </div>
            </div>
          )}

          {/* VMs Table Listing */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800 flex items-center gap-3">
              <Activity className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-white text-base">Inventário de VMs</h3>
            </div>
            
            <div className="overflow-x-auto">
              {filteredVMs.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  Nenhuma máquina virtual encontrada correspondente à busca.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase font-bold text-slate-500 tracking-wider bg-slate-950/45 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Nome da Máquina</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Configuração (CPU/RAM/Disco)</th>
                      <th className="px-6 py-4">Endereço IP</th>
                      <th className="px-6 py-4 text-right">Controles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredVMs.map((vm) => (
                      <tr 
                        key={vm.id} 
                        className={`hover:bg-slate-800/10 transition-colors relative ${
                          actionLoadingId === vm.id ? "opacity-50 pointer-events-none" : ""
                        }`}
                      >
                        <td className="px-6 py-4 text-xs font-mono text-slate-400">{vm.id}</td>
                        <td className="px-6 py-4 text-white font-bold whitespace-nowrap">{vm.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            vm.status === "RUNNING"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : vm.status === "STOPPED"
                              ? "bg-slate-800 text-slate-400 border-slate-700"
                              : vm.status === "PAUSED"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}>
                            {vm.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300 font-medium whitespace-nowrap">
                          {vm.cpu} vCPUs &bull; {vm.memory >= 1024 ? `${vm.memory / 1024} GB` : `${vm.memory} MB`} &bull; {vm.disk} GB
                        </td>
                        <td className="px-6 py-4 text-slate-400 font-mono text-xs whitespace-nowrap">
                          {vm.ipAddress ? (
                            <span className="text-blue-400 hover:underline flex items-center gap-1 cursor-pointer">
                              {vm.ipAddress}
                              <ExternalLink className="w-3 h-3 text-slate-500" />
                            </span>
                          ) : (
                            <span className="text-slate-600 italic">n/a</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {actionLoadingId === vm.id ? (
                            <div className="inline-flex items-center gap-1.5 text-xs text-blue-400 font-semibold px-4">
                              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                              <span>Aguardando nó...</span>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1.5">
                              {vm.status !== "RUNNING" ? (
                                <button
                                  onClick={() => handleVMAction(vm.id, "START")}
                                  className="p-1.5 bg-slate-950 hover:bg-emerald-950 border border-slate-850 hover:border-emerald-900 text-slate-400 hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                                  title="Ligar Máquina"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleVMAction(vm.id, "STOP")}
                                    className="p-1.5 bg-slate-950 hover:bg-red-950 border border-slate-850 hover:border-red-900 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                                    title="Desligar Máquina"
                                  >
                                    <Square className="w-3.5 h-3.5 fill-current" />
                                  </button>
                                  <button
                                    onClick={() => handleVMAction(vm.id, "REBOOT")}
                                    className="p-1.5 bg-slate-950 hover:bg-blue-950 border border-slate-850 hover:border-blue-900 text-slate-400 hover:text-blue-400 rounded-lg transition-colors cursor-pointer"
                                    title="Reiniciar Máquina"
                                  >
                                    <RotateCw className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              {vm.status === "STOPPED" && (
                                <button
                                  onClick={() => handleDeleteVM(vm.id)}
                                  className="p-1.5 bg-slate-950 hover:bg-red-950/35 border border-slate-850 hover:border-red-900 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                                  title="Deletar Máquina"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VM Wizard Modal */}
      {wizardOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl relative animate-scale-up">
            {/* Wizard Header */}
            <div className="p-6 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
                  Criar Máquina Virtual
                </h2>
                <span className="text-xs text-slate-500 font-bold bg-slate-950 border border-slate-850 px-2 py-0.5 rounded">
                  Passo {wizardStep} de 2
                </span>
              </div>
              <p className="text-slate-400 text-xs mt-1">Provisione novos recursos computacionais no nó selecionado.</p>
            </div>

            {/* Wizard Form */}
            <form onSubmit={handleCreateVM}>
              <div className="p-6 space-y-4">
                {wizardStep === 1 ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Nome da VM</label>
                      <input
                        type="text"
                        required
                        value={vmName}
                        onChange={(e) => setVmName(e.target.value)}
                        placeholder="web-server-debian"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-700 focus:outline-none focus:border-blue-500 text-sm transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Imagem / Template (Proxmox OS)</label>
                      <input
                        type="text"
                        required
                        value={vmImage}
                        onChange={(e) => setVmImage(e.target.value)}
                        placeholder="debian-12-standard_amd64.tar.zst"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-700 focus:outline-none focus:border-blue-500 text-sm transition-colors"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">CPU Cores</label>
                        <select
                          value={vmCpu}
                          onChange={(e) => setVmCpu(parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value={1}>1 Core</option>
                          <option value={2}>2 Cores</option>
                          <option value={4}>4 Cores</option>
                          <option value={8}>8 Cores</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">RAM (MB)</label>
                        <select
                          value={vmMemory}
                          onChange={(e) => setVmMemory(parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value={1024}>1 GB (1024MB)</option>
                          <option value={2048}>2 GB (2048MB)</option>
                          <option value={4096}>4 GB (4096MB)</option>
                          <option value={8192}>8 GB (8192MB)</option>
                          <option value={16384}>16 GB (16384MB)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">Disco (GB)</label>
                        <select
                          value={vmDisk}
                          onChange={(e) => setVmDisk(parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value={20}>20 GB</option>
                          <option value={40}>40 GB</option>
                          <option value={80}>80 GB</option>
                          <option value={100}>100 GB</option>
                          <option value={200}>200 GB</option>
                        </select>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-2 mt-4">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Resumo do Provisionamento</h4>
                      <p className="text-slate-400 text-xs">A máquina será provisionada com ID dinâmico alocado automaticamente pelo cluster Proxmox VE.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Wizard Footer */}
              <div className="p-6 border-t border-slate-800 flex justify-between bg-slate-900/50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setWizardOpen(false)}
                  className="px-4 py-2 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <div className="flex gap-2">
                  {wizardStep === 2 && (
                    <button
                      type="button"
                      onClick={() => setWizardStep(1)}
                      className="px-4 py-2 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Voltar
                    </button>
                  )}

                  {wizardStep === 1 ? (
                    <button
                      type="button"
                      disabled={!vmName || !vmImage}
                      onClick={() => setWizardStep(2)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Próximo</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={wizardLoading}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      {wizardLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Provisionando...</span>
                        </>
                      ) : (
                        <span>Criar Máquina</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
