"use client";
import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
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
  Sparkles,
  Terminal
} from "lucide-react";

const NoVncConsole = dynamic(() => import("@/components/NoVncConsole"), { ssr: false });

interface VM {
  id: string;
  name: string;
  status: "RUNNING" | "STOPPED" | "PAUSED" | "UNKNOWN";
  cpu: number;
  memory: number; // MB
  disk: number;   // GB
  ipAddress?: string;
  node?: string;
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
  port: number;
  nodeName: string;
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

  // Console States
  const [consoleModalOpen, setConsoleModalOpen] = useState(false);
  const [selectedVmForConsole, setSelectedVmForConsole] = useState<any>(null);
  const [vncProxyData, setVncProxyData] = useState<{ticket: string, port: number, apiPort: number, host: string, node: string, proxyAuthToken: string} | null>(null);
  const [vncLoading, setVncLoading] = useState(false);
  const [vncError, setVncError] = useState<string | null>(null);

  const handleOpenConsole = async (vm: any) => {
    setSelectedVmForConsole(vm);
    setConsoleModalOpen(true);
    setVncProxyData(null);
    setVncError(null);
    setVncLoading(true);

    try {
      const res = await fetch(`/api/vms/${vm.id}/vnc`, {
        method: "POST",
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Erro ao obter acesso ao console");
      }
      
      setVncProxyData(data);
    } catch (err: any) {
      setVncError(err.message);
    } finally {
      setVncLoading(false);
    }
  };

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
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Máquinas Virtuais</h1>
          <p className="text-text-secondary mt-1">Monitore e gerencie o ciclo de vida das instâncias centralizadas.</p>
        </div>
        {selectedHvId && (
          <button
            onClick={() => {
              setVmName("");
              setWizardStep(1);
              setWizardOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-medium transition-colors cursor-pointer shadow-lg shadow-blue-900/10 dark:shadow-blue-900/30 shrink-0"
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bg-secondary p-4 border border-border-color rounded-2xl">
        <div className="flex items-center gap-3 w-full md:max-w-xs">
          <Server className="w-5 h-5 text-text-secondary shrink-0" />
          {loadingHypervisors ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          ) : (
            <select
              value={selectedHvId}
              onChange={(e) => setSelectedHvId(e.target.value)}
              className="w-full bg-input-bg border border-input-border rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-blue-500 cursor-pointer"
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
          <input
            type="text"
            disabled={!selectedHvId}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou ID da máquina..."
            className="w-full pl-9 pr-4 py-2 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted text-sm focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
          />
        </div>
      </div>

      {/* Main content grid */}
      {!selectedHvId ? (
        <div className="py-20 text-center bg-bg-secondary/40 border border-border-color rounded-2xl">
          <Server className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-text-primary font-bold text-lg">Nenhum hipervisor selecionado</h3>
          <p className="text-text-secondary text-sm mt-1 max-w-sm mx-auto">
            Por favor, selecione um hipervisor no menu acima para carregar o painel de recursos e as máquinas virtuais.
          </p>
        </div>
      ) : loadingVms ? (
        <div className="py-32 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-text-secondary text-sm">Consultando inventário de recursos...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Host Metrics Panel */}
          {hostMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-bg-secondary/60 backdrop-blur-md p-6 border border-border-color rounded-2xl">
              {/* CPU Meter */}
              <div className="space-y-3">
                <span className="text-text-secondary text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-500" />
                  CPU Host
                </span>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-black text-text-primary">{hostMetrics.cpuUsage}%</span>
                  <span className="text-text-muted text-xs font-semibold">Uso</span>
                </div>
                <div className="w-full bg-input-bg h-2.5 rounded-full overflow-hidden border border-input-border">
                  <div 
                    className={`h-full transition-all duration-500 ${getUsageColorClass(hostMetrics.cpuUsage)}`}
                    style={{ width: `${hostMetrics.cpuUsage}%` }}
                  ></div>
                </div>
              </div>

              {/* Memory Meter */}
              <div className="space-y-3">
                <span className="text-text-secondary text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-indigo-550" />
                  RAM Host
                </span>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-black text-text-primary">{hostMetrics.memoryUsage}%</span>
                  <span className="text-text-muted text-xs font-semibold">Uso</span>
                </div>
                <div className="w-full bg-input-bg h-2.5 rounded-full overflow-hidden border border-input-border">
                  <div 
                    className={`h-full transition-all duration-500 ${getUsageColorClass(hostMetrics.memoryUsage)}`}
                    style={{ width: `${hostMetrics.memoryUsage}%` }}
                  ></div>
                </div>
              </div>

              {/* Storage Meter */}
              <div className="space-y-3">
                <span className="text-text-secondary text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-purple-550" />
                  Disco Host
                </span>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-black text-text-primary">{hostMetrics.diskUsage}%</span>
                  <span className="text-text-muted text-xs font-semibold">Uso</span>
                </div>
                <div className="w-full bg-input-bg h-2.5 rounded-full overflow-hidden border border-input-border">
                  <div 
                    className={`h-full transition-all duration-500 ${getUsageColorClass(hostMetrics.diskUsage)}`}
                    style={{ width: `${hostMetrics.diskUsage}%` }}
                  ></div>
                </div>
              </div>

              {/* Node Uptime */}
              <div className="space-y-2 flex flex-col justify-center pl-0 md:pl-6 border-t md:border-t-0 md:border-l border-border-color">
                <span className="text-text-secondary text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-text-muted" />
                  Uptime do Host
                </span>
                <span className="text-lg font-bold text-text-primary">
                  {formatUptime(hostMetrics.uptime)}
                </span>
                <span className="text-[10px] text-text-muted">Node status online</span>
              </div>
            </div>
          )}

          {/* VMs Table Listing */}
          <div className="bg-bg-secondary border border-border-color rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-border-color flex items-center gap-3">
              <Activity className="w-5 h-5 text-blue-550" />
              <h3 className="font-bold text-text-primary text-base">Inventário de VMs</h3>
            </div>
            
            <div className="overflow-x-auto">
              {filteredVMs.length === 0 ? (
                <div className="p-12 text-center text-text-muted text-sm">
                  Nenhuma máquina virtual encontrada correspondente à busca.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase font-bold text-text-secondary tracking-wider bg-bg-primary/45 border-b border-border-color">
                    <tr>
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Nome da Máquina</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Configuração (CPU/RAM/Disco)</th>
                      <th className="px-6 py-4">Endereço IP</th>
                      <th className="px-6 py-4 text-right">Controles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color">
                    {filteredVMs.map((vm) => (
                      <tr 
                        key={vm.id} 
                        className={`hover:bg-bg-tertiary/10 transition-colors relative ${
                          actionLoadingId === vm.id ? "opacity-50 pointer-events-none" : ""
                        }`}
                      >
                        <td className="px-6 py-4 text-xs font-mono text-text-secondary">{vm.id}</td>
                        <td className="px-6 py-4 text-text-primary font-bold whitespace-nowrap">{vm.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            vm.status === "RUNNING"
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              : vm.status === "STOPPED"
                              ? "bg-bg-tertiary text-text-secondary border-border-color"
                              : vm.status === "PAUSED"
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              : "bg-red-500/10 text-red-550 border-red-500/20"
                          }`}>
                            {vm.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-text-secondary font-medium whitespace-nowrap">
                          {vm.cpu} vCPUs &bull; {vm.memory >= 1024 ? `${vm.memory / 1024} GB` : `${vm.memory} MB`} &bull; {vm.disk} GB
                        </td>
                        <td className="px-6 py-4 text-text-secondary font-mono text-xs whitespace-nowrap">
                          {vm.ipAddress ? (
                            <span className="text-blue-500 hover:underline flex items-center gap-1 cursor-pointer">
                              {vm.ipAddress}
                              <ExternalLink className="w-3 h-3 text-text-muted" />
                            </span>
                          ) : (
                            <span className="text-text-muted italic">n/a</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {actionLoadingId === vm.id ? (
                            <div className="inline-flex items-center gap-1.5 text-xs text-blue-550 font-semibold px-4">
                              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                              <span>Aguardando nó...</span>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1.5">
                              {vm.status !== "RUNNING" ? (
                                <button
                                  onClick={() => handleVMAction(vm.id, "START")}
                                  className="p-1.5 bg-bg-primary hover:bg-bg-tertiary border border-border-color hover:border-border-color/85 text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer"
                                  title="Ligar Máquina"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleOpenConsole(vm)}
                                    className="p-1.5 bg-bg-primary hover:bg-blue-500/10 border border-border-color hover:border-blue-500/30 text-text-secondary hover:text-blue-500 rounded-lg transition-colors cursor-pointer"
                                    title="Acessar Console noVNC"
                                  >
                                    <Terminal className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleVMAction(vm.id, "STOP")}
                                    className="p-1.5 bg-bg-primary hover:bg-bg-tertiary border border-border-color hover:border-border-color/85 text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer"
                                    title="Desligar Máquina"
                                  >
                                    <Square className="w-3.5 h-3.5 fill-current" />
                                  </button>
                                  <button
                                    onClick={() => handleVMAction(vm.id, "REBOOT")}
                                    className="p-1.5 bg-bg-primary hover:bg-bg-tertiary border border-border-color hover:border-border-color/85 text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer"
                                    title="Reiniciar Máquina"
                                  >
                                    <RotateCw className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              {vm.status === "STOPPED" && (
                                <button
                                  onClick={() => handleDeleteVM(vm.id)}
                                  className="p-1.5 bg-bg-primary hover:bg-red-500/10 border border-border-color hover:border-red-500/30 text-text-secondary hover:text-red-500 rounded-lg transition-colors cursor-pointer"
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
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-border-color rounded-2xl w-full max-w-lg shadow-2xl relative animate-scale-up">
            {/* Wizard Header */}
            <div className="p-6 border-b border-border-color">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-500 animate-pulse" />
                  Criar Máquina Virtual
                </h2>
                <span className="text-xs text-text-secondary font-bold bg-bg-primary border border-border-color px-2 py-0.5 rounded">
                  Passo {wizardStep} de 2
                </span>
              </div>
              <p className="text-text-secondary text-xs mt-1">Provisione novos recursos computacionais no nó selecionado.</p>
            </div>

            {/* Wizard Form */}
            <form onSubmit={handleCreateVM}>
              <div className="p-6 space-y-4">
                {wizardStep === 1 ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Nome da VM</label>
                      <input
                        type="text"
                        required
                        value={vmName}
                        onChange={(e) => setVmName(e.target.value)}
                        placeholder="web-server-debian"
                        className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Imagem / Template (Proxmox OS)</label>
                      <input
                        type="text"
                        required
                        value={vmImage}
                        onChange={(e) => setVmImage(e.target.value)}
                        placeholder="debian-12-standard_amd64.tar.zst"
                        className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">CPU Cores</label>
                        <select
                          value={vmCpu}
                          onChange={(e) => setVmCpu(parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value={1}>1 Core</option>
                          <option value={2}>2 Cores</option>
                          <option value={4}>4 Cores</option>
                          <option value={8}>8 Cores</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">RAM (MB)</label>
                        <select
                          value={vmMemory}
                          onChange={(e) => setVmMemory(parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value={1024}>1 GB (1024MB)</option>
                          <option value={2048}>2 GB (2048MB)</option>
                          <option value={4096}>4 GB (4096MB)</option>
                          <option value={8192}>8 GB (8192MB)</option>
                          <option value={16384}>16 GB (16384MB)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Disco (GB)</label>
                        <select
                          value={vmDisk}
                          onChange={(e) => setVmDisk(parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value={20}>20 GB</option>
                          <option value={40}>40 GB</option>
                          <option value={80}>80 GB</option>
                          <option value={100}>100 GB</option>
                          <option value={200}>200 GB</option>
                        </select>
                      </div>
                    </div>

                    <div className="p-4 bg-bg-primary border border-border-color rounded-xl space-y-2 mt-4">
                      <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider">Resumo do Provisionamento</h4>
                      <p className="text-text-secondary text-xs">A máquina será provisionada com ID dinâmico alocado automaticamente pelo cluster Proxmox VE.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Wizard Footer */}
              <div className="p-6 border-t border-border-color flex justify-between bg-bg-secondary/50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setWizardOpen(false)}
                  className="px-4 py-2.5 border border-border-color hover:bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <div className="flex gap-2">
                  {wizardStep === 2 && (
                    <button
                      type="button"
                      onClick={() => setWizardStep(1)}
                      className="px-4 py-2.5 border border-border-color hover:bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Voltar
                    </button>
                  )}

                  {wizardStep === 1 ? (
                    <button
                      type="button"
                      disabled={!vmName || !vmImage}
                      onClick={() => setWizardStep(2)}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Próximo</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={wizardLoading}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
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

      {/* Console Access Modal */}
      {consoleModalOpen && selectedVmForConsole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-bg-secondary w-full max-w-4xl rounded-2xl shadow-2xl border border-border-color overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-border-color shrink-0">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-500" />
                Console da VM: <span className="text-blue-500">{selectedVmForConsole.name}</span>
              </h2>
              <p className="text-text-secondary text-xs mt-1">Acesso direto ao terminal e interface gráfica da máquina virtual.</p>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden bg-black flex flex-col min-h-[500px]">
              {vncLoading && (
                <div className="h-full flex flex-col items-center justify-center text-text-secondary">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm">Negociando conexão segura com o Proxmox...</p>
                </div>
              )}
              
              {vncError && (
                <div className="h-full flex items-center justify-center p-6">
                  <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl p-6 max-w-md text-center space-y-3">
                    <AlertCircle className="w-8 h-8 mx-auto" />
                    <p className="font-bold">Falha ao Conectar</p>
                    <p className="text-xs">{vncError}</p>
                    <button 
                      onClick={() => handleOpenConsole(selectedVmForConsole)}
                      className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-xs font-semibold transition-colors"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                </div>
              )}

              {vncProxyData && !vncLoading && !vncError && (
                <div className="h-full">
                  <NoVncConsole 
                    ticket={vncProxyData.ticket}
                    port={vncProxyData.port}
                    apiPort={vncProxyData.apiPort}
                    host={vncProxyData.host}
                    node={vncProxyData.node}
                    vmid={selectedVmForConsole.id}
                    proxyAuthToken={vncProxyData.proxyAuthToken}
                    type="vnc"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border-color bg-bg-secondary/50 flex justify-between items-center shrink-0">
               {(() => {
                const selectedHv = hypervisors.find(h => h.id === selectedHvId);
                if (!selectedHv) return null;
                const host = selectedHv.host.replace(/^https?:\/\//, "");
                const port = selectedHv.port || 8006;
                const node = selectedVmForConsole.node || selectedHv.nodeName || "pve";
                const panelUrl = `https://${host}:${port}/#v1:0:18:4:${node}:${selectedVmForConsole.id}:console`;
                
                return (
                  <a href={panelUrl} target="_blank" rel="noreferrer" className="text-xs text-text-muted hover:text-blue-500 transition-colors flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Abrir no painel oficial do Proxmox
                  </a>
                )
               })()}
              <button
                type="button"
                onClick={() => setConsoleModalOpen(false)}
                className="px-6 py-2 border border-border-color hover:bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
