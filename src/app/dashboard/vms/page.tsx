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
  Terminal,
  Settings,
  Lock
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
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardLoading, setWizardLoading] = useState(false);

  // Enhanced Wizard States
  const [metricsHvList, setMetricsHvList] = useState<any[]>([]);
  const [loadingMetricsHv, setLoadingMetricsHv] = useState(false);
  const [selectedHvForWizard, setSelectedHvForWizard] = useState("");
  const [availableIsos, setAvailableIsos] = useState<any[]>([]);
  const [availableStorages, setAvailableStorages] = useState<any[]>([]);
  const [loadingHvDetails, setLoadingHvDetails] = useState(false);
  const [selectedIso, setSelectedIso] = useState("");
  const [wizardDisks, setWizardDisks] = useState<{ storage: string; size: number }[]>([]);
  const [deleteConfirmVmId, setDeleteConfirmVmId] = useState<string | null>(null);
  const [clusterNodes, setClusterNodes] = useState<any[]>([]);
  const [availableNodes, setAvailableNodes] = useState<any[]>([]);
  const [selectedNodeForWizard, setSelectedNodeForWizard] = useState("");
  const [vmIpAddress, setVmIpAddress] = useState("");
  const [userRole, setUserRole] = useState<string>("VIEWER");
  const [userAccess, setUserAccess] = useState<string>("VIEW");

  // Console States
  const [consoleModalOpen, setConsoleModalOpen] = useState(false);
  const [selectedVmForConsole, setSelectedVmForConsole] = useState<any>(null);
  const [vncProxyData, setVncProxyData] = useState<{ticket: string, port: number, apiPort: number, host: string, node: string, proxyAuthToken: string} | null>(null);
  const [vncLoading, setVncLoading] = useState(false);
  const [vncError, setVncError] = useState<string | null>(null);

  // VM Edit States
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingVm, setEditingVm] = useState<VM | null>(null);
  const [editVmName, setEditVmName] = useState("");
  const [editVmCpu, setEditVmCpu] = useState(2);
  const [editVmMemory, setEditVmMemory] = useState(2048);
  const [editVmIpAddress, setEditVmIpAddress] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Template States
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateNameInput, setTemplateNameInput] = useState("");
  const [showSaveTemplateInput, setShowSaveTemplateInput] = useState(false);
  const [selectedStorageForTemplate, setSelectedStorageForTemplate] = useState("");

  useEffect(() => {
    if (selectedHvForWizard && wizardOpen) {
      fetchHvDetails(selectedHvForWizard);
    }
  }, [selectedHvForWizard, wizardOpen]);



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
        const activeHvs = (data.hypervisors || []).filter((h: any) => h.status !== "OFFLINE");
        setHypervisors(activeHvs);
        if (activeHvs.length > 0) {
          // Auto select first hypervisor
          setSelectedHvId(activeHvs[0].id);
        } else {
          setSelectedHvId("");
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
        setClusterNodes(data.nodes || []);
        setUserRole(data.userRole || "VIEWER");
        setUserAccess(data.userAccess || "VIEW");
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
      setDeleteConfirmVmId(null);
    }
  };

  const handleOpenEditModal = (vm: VM) => {
    setEditingVm(vm);
    setEditVmName(vm.name);
    setEditVmCpu(vm.cpu);
    setEditVmMemory(vm.memory);
    setEditVmIpAddress(vm.ipAddress || "");
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVm || !selectedHvId) return;

    setEditLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/vms/${editingVm.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hypervisorId: selectedHvId,
          name: editVmName,
          cpu: editVmCpu,
          memory: editVmMemory,
          ipAddress: editVmIpAddress,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Falha ao atualizar hardware da VM.");
      }

      setSuccess("Configurações da VM atualizadas com sucesso!");
      setEditModalOpen(false);
      setEditingVm(null);
      fetchVMs(selectedHvId);
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar alterações de hardware.");
    } finally {
      setEditLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/vms/templates");
      const data = await res.json();
      if (res.ok) {
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error("Failed to load VM templates:", err);
    }
  };

  const handleApplyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    setVmCpu(template.cpu);
    setVmMemory(template.memory);
    if (template.node) {
      setSelectedNodeForWizard(template.node);
    }
    if (template.iso) {
      setSelectedIso(template.iso);
    }
    try {
      const parsedDisks = JSON.parse(template.disks);
      if (Array.isArray(parsedDisks)) {
        setWizardDisks(parsedDisks);
        if (parsedDisks.length > 0) {
          setSelectedStorageForTemplate(parsedDisks[0].storage);
        }
      }
    } catch (e) {
      console.error("Failed to parse template disks:", e);
    }
  };

  const handleStorageChangeForTemplate = (storageName: string) => {
    setSelectedStorageForTemplate(storageName);
    setWizardDisks((prevDisks) =>
      prevDisks.map((disk) => ({
        ...disk,
        storage: storageName
      }))
    );
  };


  const handleSaveAsTemplate = async () => {
    if (!templateNameInput.trim()) return;
    try {
      const res = await fetch("/api/vms/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateNameInput.trim(),
          cpu: vmCpu,
          memory: vmMemory,
          disks: wizardDisks,
          iso: selectedIso || null,
          node: selectedNodeForWizard || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTemplateNameInput("");
        setShowSaveTemplateInput(false);
        // Refresh templates list
        const refreshedRes = await fetch("/api/vms/templates");
        const refreshedData = await refreshedRes.json();
        if (refreshedRes.ok) {
          const list = refreshedData.templates || [];
          setTemplates(list);
          const found = list.find((t: any) => t.name === data.template?.name);
          if (found) {
            setSelectedTemplateId(found.id);
          }
        }
      } else {
        alert(data.error || "Erro ao salvar template.");
      }
    } catch (err) {
      console.error("Error saving template:", err);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Deseja realmente excluir este template?")) return;
    try {
      const res = await fetch(`/api/vms/templates?id=${templateId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchTemplates();
        setSelectedTemplateId("");
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao excluir template.");
      }
    } catch (err) {
      console.error("Error deleting template:", err);
    }
  };

  const openWizard = async () => {
    setVmName("");
    setWizardStep(1);
    setSelectedHvForWizard(selectedHvId || "");
    setWizardDisks([{ storage: "", size: 40 }]);
    setSelectedIso("");
    setSelectedTemplateId("");
    setShowSaveTemplateInput(false);
    setWizardOpen(true);

    // Load VM templates
    fetchTemplates();

    
    // Fetch hypervisors metrics
    setLoadingMetricsHv(true);
    try {
      const res = await fetch("/api/admin/hypervisors/metrics");
      const data = await res.json();
      if (res.ok) {
        setMetricsHvList(data.hypervisors || []);
        if (data.hypervisors?.length > 0 && !selectedHvId) {
          setSelectedHvForWizard(data.hypervisors[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load hypervisors metrics:", err);
    } finally {
      setLoadingMetricsHv(false);
    }
  };

  const fetchHvDetails = async (hvId: string) => {
    setLoadingHvDetails(true);
    try {
      const res = await fetch(`/api/vms/hypervisor-details?hypervisorId=${hvId}`);
      const data = await res.json();
      if (res.ok) {
        setAvailableIsos(data.isos || []);
        setAvailableStorages(data.storages || []);
        setAvailableNodes(data.nodes || []);
        if (data.nodes?.length > 0) {
          setSelectedNodeForWizard(data.nodes[0].name);
        } else {
          setSelectedNodeForWizard("");
        }
        
        // Default the first disk storage to the first available storage
        if (data.storages?.length > 0) {
          setWizardDisks([{ storage: data.storages[0].name, size: 40 }]);
        }
      }
    } catch (err) {
      console.error("Failed to load hypervisor details:", err);
    } finally {
      setLoadingHvDetails(false);
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
          hypervisorId: selectedHvForWizard,
          name: vmName,
          cpu: vmCpu,
          memory: vmMemory,
          disks: wizardDisks,
          iso: selectedIso || null,
          node: selectedNodeForWizard || null,
          ipAddress: vmIpAddress || null
        })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(`Máquina virtual "${vmName}" criada com sucesso!`);
        setWizardOpen(false);
        setVmIpAddress("");
        if (selectedHvForWizard === selectedHvId) {
          fetchVMs(selectedHvId);
        } else {
          setSelectedHvId(selectedHvForWizard);
        }
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
      (vm.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
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
        {(userRole === "ADMIN" || userAccess === "FULL") && (
          <button
            onClick={openWizard}
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
          <h3 className="text-text-primary font-bold text-lg">
            {hypervisors.length === 0 ? "Nenhum hipervisor online disponível" : "Nenhum hipervisor selecionado"}
          </h3>
          <p className="text-text-secondary text-sm mt-1 max-w-sm mx-auto">
            {hypervisors.length === 0 
              ? "Cadastre ou ative seus nós na aba de Hipervisores para começar a gerenciar suas máquinas virtuais." 
              : "Por favor, selecione um hipervisor no menu acima para carregar o painel de recursos e as máquinas virtuais."}
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

          {/* Cluster Nodes Section */}
          {clusterNodes && clusterNodes.length > 0 && (
            <div className="bg-bg-secondary/60 backdrop-blur-md border border-border-color rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-500 animate-pulse" />
                <h4 className="font-bold text-text-primary text-xs uppercase tracking-wider">Nós do Cluster Proxmox</h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {clusterNodes.map((node) => (
                  <div key={node.name} className="p-4 rounded-xl border border-border-color bg-bg-primary/45 flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-text-primary text-sm flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-text-muted" />
                        {node.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black border ${
                        node.status === "ONLINE"
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : "bg-red-500/10 text-red-500 border-red-500/20"
                      }`}>
                        {node.status}
                      </span>
                    </div>
                    
                    {node.status === "ONLINE" ? (
                      <div className="space-y-2 text-xs">
                        <div className="space-y-1">
                          <div className="flex justify-between text-text-secondary text-[10px] font-semibold">
                            <span>CPU</span>
                            <span>{node.cpuUsage}%</span>
                          </div>
                          <div className="w-full bg-input-bg h-1.5 rounded-full overflow-hidden border border-input-border">
                            <div 
                              className={`h-full transition-all duration-300 ${getUsageColorClass(node.cpuUsage)}`}
                              style={{ width: `${node.cpuUsage}%` }}
                            ></div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-text-secondary text-[10px] font-semibold">
                            <span>RAM</span>
                            <span>{node.memoryUsage}% ({Math.round(node.memoryUsed / 1024)} GB / {Math.round(node.memoryTotal / 1024)} GB)</span>
                          </div>
                          <div className="w-full bg-input-bg h-1.5 rounded-full overflow-hidden border border-input-border">
                            <div 
                              className={`h-full transition-all duration-300 ${getUsageColorClass(node.memoryUsage)}`}
                              style={{ width: `${node.memoryUsage}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Volumes / Storages list */}
                        {node.storages && node.storages.length > 0 && (
                          <div className="pt-2.5 border-t border-border-color space-y-2">
                            <span className="block text-[9px] font-black text-text-secondary uppercase tracking-wider">Volumes / Storages</span>
                            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                              {node.storages.map((storage: any) => {
                                const formatSizeGB = (bytes: number) => {
                                  return `${Math.round(bytes / (1024 * 1024 * 1024))} GB`;
                                };
                                return (
                                  <div key={storage.name} className="flex flex-col gap-1 p-2 bg-input-bg/30 border border-input-border/20 rounded-xl text-[10px] transition-colors hover:bg-input-bg/50">
                                    <div className="flex justify-between font-bold text-text-primary">
                                      <span className="truncate">{storage.name} <span className="text-text-muted text-[8px] font-normal">({storage.type})</span></span>
                                      <span>{storage.percent}%</span>
                                    </div>
                                    <div className="w-full bg-input-bg h-1 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full transition-all duration-300 ${getUsageColorClass(storage.percent)}`}
                                        style={{ width: `${storage.percent}%` }}
                                      ></div>
                                    </div>
                                    <div className="flex justify-between text-[8px] text-text-muted">
                                      <span>{formatSizeGB(storage.used)} usado</span>
                                      <span>{formatSizeGB(storage.total)} total</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-text-muted italic py-2">
                        Nó offline ou inacessível.
                      </div>
                    )}
                  </div>
                ))}
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
                      <th className="px-6 py-4 text-center">ID</th>
                      <th className="px-6 py-4 text-center">Nome da Máquina</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-center">Configuração (CPU/RAM/Disco)</th>
                      <th className="px-6 py-4 text-center">Endereço IP</th>
                      <th className="px-6 py-4 text-center">Controles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color">
                    {filteredVMs.map((vm) => {
                      const canControl = userRole === "ADMIN" || userAccess === "FULL" || userAccess === "CONTROL";
                      const canDelete = userRole === "ADMIN" || userAccess === "FULL";
                      
                      return (
                        <tr 
                          key={vm.id} 
                          className={`hover:bg-bg-tertiary/10 transition-colors relative ${
                            actionLoadingId === vm.id ? "opacity-50 pointer-events-none" : ""
                          }`}
                        >
                          <td className="px-6 py-4 text-xs font-mono text-text-secondary text-center">{vm.id}</td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <div className="font-bold text-text-primary">{vm.name || `VM ${vm.id}`}</div>
                            {vm.node && (
                              <div className="text-[10px] text-text-secondary mt-1 font-medium flex items-center justify-center gap-1">
                                <Server className="w-3 h-3 text-text-muted animate-pulse" />
                                {vm.node}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
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
                          <td className="px-6 py-4 text-text-secondary font-medium whitespace-nowrap text-center">
                            {vm.cpu} vCPUs &bull; {vm.memory >= 1024 ? `${vm.memory / 1024} GB` : `${vm.memory} MB`} &bull; {vm.disk} GB
                          </td>
                          <td className="px-6 py-4 text-text-secondary font-mono text-xs whitespace-nowrap text-center">
                            {vm.ipAddress ? (
                              <span className="text-blue-500 hover:underline inline-flex items-center gap-1 cursor-pointer justify-center w-full">
                                {vm.ipAddress}
                                <ExternalLink className="w-3 h-3 text-text-muted" />
                              </span>
                            ) : (
                              <span className="text-text-muted italic">n/a</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            {actionLoadingId === vm.id ? (
                              <div className="inline-flex items-center justify-center gap-1.5 text-xs text-blue-550 font-semibold w-full">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                <span>Aguardando nó...</span>
                              </div>
                            ) : (
                              <div className="flex justify-center gap-1.5">
                                {!canControl && !canDelete && (
                                  <span className="text-xs text-text-muted inline-flex items-center gap-1 py-1">
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Visualizar</span>
                                  </span>
                                )}

                                {canControl && vm.status !== "RUNNING" && (
                                  <button
                                    onClick={() => handleVMAction(vm.id, "START")}
                                    className="p-1.5 bg-bg-primary hover:bg-bg-tertiary border border-border-color hover:border-border-color/85 text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer"
                                    title="Ligar Máquina"
                                  >
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                  </button>
                                )}

                                {canControl && vm.status === "RUNNING" && (
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

                                {canControl && (
                                  <button
                                    onClick={() => handleOpenEditModal(vm)}
                                    className="p-1.5 bg-bg-primary hover:bg-bg-tertiary border border-border-color hover:border-border-color/85 text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer"
                                    title="Editar Hardware"
                                  >
                                    <Settings className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {canDelete && vm.status === "STOPPED" && (
                                  <button
                                    onClick={() => setDeleteConfirmVmId(vm.id)}
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
                      );
                    })}
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
          <div className="bg-bg-secondary border border-border-color rounded-2xl w-full max-w-2xl shadow-2xl relative animate-scale-up">
            {/* Wizard Header */}
            <div className="p-6 border-b border-border-color">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-500 animate-pulse" />
                  Criar Máquina Virtual
                </h2>
                <span className="text-xs text-text-secondary font-bold bg-bg-primary border border-border-color px-2 py-0.5 rounded">
                  Passo {wizardStep} de 4
                </span>
              </div>
              <p className="text-text-secondary text-xs mt-1">Configure o novo provisionamento de recursos de forma guiada.</p>
            </div>

            {/* Template Selector Bar */}
            <div className="px-6 py-3 bg-bg-primary/45 border-b border-border-color flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <span className="font-semibold text-text-secondary whitespace-nowrap">Usar Template:</span>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleApplyTemplate(e.target.value)}
                  className="bg-bg-secondary border border-border-color rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none cursor-pointer min-w-[160px]"
                >
                  <option value="">Nenhum (Configuração Manual)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {selectedTemplateId && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTemplate(selectedTemplateId)}
                    className="p-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-colors cursor-pointer"
                    title="Excluir este template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {showSaveTemplateInput ? (
                  <div className="flex items-center gap-1.5 animate-fade-in">
                    <input
                      type="text"
                      placeholder="Nome do Template..."
                      value={templateNameInput}
                      onChange={(e) => setTemplateNameInput(e.target.value)}
                      className="bg-bg-secondary border border-border-color rounded-lg px-2.5 py-1 text-xs text-text-primary outline-none max-w-[140px]"
                    />
                    <button
                      type="button"
                      onClick={handleSaveAsTemplate}
                      disabled={!templateNameInput.trim()}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSaveTemplateInput(false)}
                      className="text-text-secondary hover:text-text-primary px-1 font-bold cursor-pointer"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTemplateNameInput("");
                      setShowSaveTemplateInput(true);
                    }}
                    className="flex items-center gap-1 text-blue-500 hover:text-blue-400 font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Salvar Configuração como Template</span>
                  </button>
                )}
              </div>
            </div>


            {/* Wizard Form */}
            <div>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                {selectedTemplateId ? (
                  <div className="space-y-4">
                    {/* Select Hypervisor */}
                    <div>
                      <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Virtualizador / Hipervisor</label>
                      {loadingMetricsHv ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                          <span className="text-text-secondary text-xs">Carregando hipervisores...</span>
                        </div>
                      ) : (
                        <select
                          value={selectedHvForWizard}
                          onChange={(e) => setSelectedHvForWizard(e.target.value)}
                          className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="">Selecione um Hipervisor...</option>
                          {metricsHvList.filter(hv => hv.status === "online").map((hv) => (
                            <option key={hv.id} value={hv.id}>
                              {hv.name} ({hv.type})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* VM Name */}
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

                    {/* Target Node (Cluster) */}
                    {availableNodes.length > 0 && (
                      <div>
                        <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Nó de Destino (Cluster)</label>
                        <select
                          value={selectedNodeForWizard}
                          onChange={(e) => setSelectedNodeForWizard(e.target.value)}
                          className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          {availableNodes.map((node) => (
                            <option key={node.name} value={node.name}>
                              {node.name} ({node.status})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* ISO Image */}
                    <div>
                      <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Imagem de Inicialização (ISO)</label>
                      {loadingHvDetails ? (
                        <div className="flex items-center gap-2 text-text-secondary text-xs">
                          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                          <span>Carregando ISOs...</span>
                        </div>
                      ) : (
                        <select
                          value={selectedIso}
                          onChange={(e) => setSelectedIso(e.target.value)}
                          className="w-full px-3 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="">Sem ISO (Iniciar com CD-ROM vazio)</option>
                          {availableIsos.map((iso) => (
                            <option key={iso.volid} value={iso.volid}>
                              {iso.name} ({iso.volid.split(":")[0]})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Storage Pool (Local de Armazenamento) */}
                    <div>
                      <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Local de Armazenamento</label>
                      {loadingHvDetails ? (
                        <div className="flex items-center gap-2 text-text-secondary text-xs">
                          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                          <span>Carregando storages...</span>
                        </div>
                      ) : (
                        <select
                          value={selectedStorageForTemplate}
                          onChange={(e) => handleStorageChangeForTemplate(e.target.value)}
                          className="w-full px-3 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="">Selecione o storage...</option>
                          {availableStorages.map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.name} ({s.type})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Show Template Hardware Preview */}
                    <div className="p-4 bg-bg-primary/50 border border-border-color rounded-xl space-y-2 text-xs">
                      <div className="font-bold text-text-primary text-[10px] uppercase tracking-wider">Especificações do Template Utilizado:</div>
                      <div className="grid grid-cols-2 gap-4 text-text-secondary">
                        <div><span className="font-semibold text-text-muted">CPU:</span> {vmCpu} {vmCpu === 1 ? "Core" : "Cores"}</div>
                        <div><span className="font-semibold text-text-muted">RAM:</span> {vmMemory >= 1024 ? `${vmMemory / 1024} GB` : `${vmMemory} MB`}</div>
                        <div className="col-span-2">
                          <span className="font-semibold text-text-muted">Discos:</span>{" "}
                          {wizardDisks.map((d, i) => `${d.size}GB no storage ${d.storage || "não selecionado"}`).join(", ")}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {wizardStep === 1 && (
                      <div className="space-y-4">
                        <label className="block text-text-secondary text-xs font-bold uppercase tracking-wider">
                          Selecione o Virtualizador / Nó Destino
                        </label>
                        {loadingMetricsHv ? (
                          <div className="py-12 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            <p className="text-text-secondary text-xs">Acessando nós e coletando métricas em tempo real...</p>
                          </div>
                        ) : metricsHvList.length === 0 ? (
                          <div className="p-8 text-center bg-bg-primary border border-border-color rounded-xl text-text-secondary text-xs">
                            Nenhum hipervisor configurado ou online.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {metricsHvList.map((hv) => (
                              <div
                                key={hv.id}
                                onClick={() => hv.status === "online" && setSelectedHvForWizard(hv.id)}
                                className={`p-4 border rounded-xl cursor-pointer transition-all ${
                                  selectedHvForWizard === hv.id
                                    ? "border-blue-500 bg-blue-500/5 shadow-md shadow-blue-500/5"
                                    : "border-border-color bg-bg-primary/50 hover:bg-bg-primary"
                                } ${hv.status !== "online" ? "opacity-50 cursor-not-allowed" : ""}`}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <span className="font-bold text-sm text-text-primary">{hv.name}</span>
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    hv.status === "online" 
                                      ? "bg-emerald-500/10 text-emerald-500" 
                                      : "bg-red-500/10 text-red-500"
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${hv.status === "online" ? "bg-emerald-500" : "bg-red-500"}`}></span>
                                    {hv.status === "online" ? "Online" : "Offline"}
                                  </span>
                                </div>
                                <div className="text-[10px] text-text-secondary mb-3">{hv.type} - {hv.host}</div>
                                
                                {hv.status === "online" && (
                                  <div className="space-y-2">
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-[10px]">
                                        <span className="text-text-secondary">CPU Host</span>
                                        <span className="font-semibold text-text-primary">{hv.cpuUsage}%</span>
                                      </div>
                                      <div className="w-full bg-input-bg h-1.5 rounded-full overflow-hidden border border-input-border">
                                        <div className="h-full bg-blue-500" style={{ width: `${hv.cpuUsage}%` }}></div>
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-[10px]">
                                        <span className="text-text-secondary">RAM Host</span>
                                        <span className="font-semibold text-text-primary">{hv.memoryUsage}%</span>
                                      </div>
                                      <div className="w-full bg-input-bg h-1.5 rounded-full overflow-hidden border border-input-border">
                                        <div className="h-full bg-indigo-500" style={{ width: `${hv.memoryUsage}%` }}></div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {wizardStep === 2 && (
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
                        <div className="grid grid-cols-2 gap-4">
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
                              <option value={32768}>32 GB (32768MB)</option>
                            </select>
                          </div>
                        </div>
                        {availableNodes.length > 0 && (
                          <div>
                            <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Nó de Destino (Cluster)</label>
                            {loadingHvDetails ? (
                              <div className="flex items-center gap-2 py-4">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                                <span className="text-text-secondary text-xs">Carregando nós do cluster...</span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {availableNodes.map((node) => {
                                  const isSelected = selectedNodeForWizard === node.name;
                                  const isOnline = node.status === "ONLINE" || node.status === "online";
                                  const nodeStorages = (node.storages || []) as any[];
                                  const formatBytes = (bytes: number) => {
                                    if (!bytes) return "—";
                                    const gb = bytes / (1024 ** 3);
                                    return gb >= 1024 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(0)} GB`;
                                  };
                                  return (
                                    <div
                                      key={node.name}
                                      onClick={() => isOnline && setSelectedNodeForWizard(node.name)}
                                      className={`border rounded-xl p-3 transition-all ${
                                        isSelected
                                          ? "border-blue-500 bg-blue-500/5 shadow-sm shadow-blue-500/10"
                                          : isOnline
                                          ? "border-border-color bg-bg-primary/40 hover:border-blue-500/50 hover:bg-bg-primary/70 cursor-pointer"
                                          : "border-border-color bg-bg-primary/20 opacity-50 cursor-not-allowed"
                                      }`}
                                    >
                                      {/* Node header */}
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          {isSelected && (
                                            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                                          )}
                                          <span className="font-bold text-sm text-text-primary">{node.name}</span>
                                        </div>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${
                                          isOnline
                                            ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                            : "bg-red-500/10 text-red-500 border-red-500/20"
                                        }`}>
                                          {isOnline ? "ONLINE" : "OFFLINE"}
                                        </span>
                                      </div>

                                      {/* Storage table */}
                                      {isOnline && nodeStorages.length > 0 && (
                                        <div className="mt-2">
                                          <div className="text-[9px] font-black text-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                            <Database className="w-3 h-3" />
                                            Volumes / Storages
                                          </div>
                                          <div className="w-full overflow-hidden rounded-lg border border-border-color/50">
                                            <table className="w-full text-[10px]">
                                              <thead>
                                                <tr className="bg-bg-primary/60 border-b border-border-color/50">
                                                  <th className="text-left px-2 py-1 text-text-muted font-semibold">Nome</th>
                                                  <th className="text-left px-2 py-1 text-text-muted font-semibold">Tipo</th>
                                                  <th className="text-right px-2 py-1 text-text-muted font-semibold">Disponível</th>
                                                  <th className="text-right px-2 py-1 text-text-muted font-semibold">Total</th>
                                                  <th className="text-right px-2 py-1 text-text-muted font-semibold">Uso</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {nodeStorages.map((s: any) => (
                                                  <tr key={s.name} className="border-b border-border-color/30 last:border-0 hover:bg-bg-primary/40 transition-colors">
                                                    <td className="px-2 py-1.5 font-bold text-text-primary">{s.name}</td>
                                                    <td className="px-2 py-1.5 text-text-secondary">
                                                      <span className="px-1.5 py-0.5 bg-bg-primary/60 border border-border-color/40 rounded text-[8px]">{s.type}</span>
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right text-emerald-400 font-semibold">{formatBytes(s.avail)}</td>
                                                    <td className="px-2 py-1.5 text-right text-text-secondary">{formatBytes(s.total)}</td>
                                                    <td className="px-2 py-1.5 text-right">
                                                      <div className="flex items-center justify-end gap-1.5">
                                                        <div className="w-12 bg-input-bg h-1 rounded-full overflow-hidden">
                                                          <div
                                                            className={`h-full transition-all ${getUsageColorClass(s.percent)}`}
                                                            style={{ width: `${s.percent}%` }}
                                                          />
                                                        </div>
                                                        <span className={`font-bold ${
                                                          s.percent >= 90 ? "text-rose-400" : s.percent >= 70 ? "text-amber-400" : "text-text-secondary"
                                                        }`}>{s.percent}%</span>
                                                      </div>
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      )}

                                      {isOnline && nodeStorages.length === 0 && (
                                        <p className="text-[10px] text-text-muted italic mt-1">Nenhum storage detectado neste nó.</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                        <div>
                          <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Endereço IP (Opcional / Manual)</label>
                          <input
                            type="text"
                            value={vmIpAddress}
                            onChange={(e) => setVmIpAddress(e.target.value)}
                            placeholder="Ex: 192.168.1.50"
                            className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                          />
                        </div>
                      </div>
                    )}

                    {wizardStep === 3 && (
                      <div className="space-y-4">
                        <label className="block text-text-secondary text-xs font-bold uppercase tracking-wider">
                          Selecione a Imagem de Inicialização (ISO)
                        </label>
                        {loadingHvDetails ? (
                          <div className="py-12 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            <p className="text-text-secondary text-xs">Buscando ISOs disponíveis no hipervisor...</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <select
                              value={selectedIso}
                              onChange={(e) => setSelectedIso(e.target.value)}
                              className="w-full px-3 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                            >
                              <option value="">Sem ISO (Iniciar com CD-ROM vazio / Sem sistema)</option>
                              {availableIsos.map((iso) => (
                                <option key={iso.volid} value={iso.volid}>
                                  {iso.name} ({iso.volid.split(":")[0]})
                                </option>
                              ))}
                            </select>
                            <p className="text-[10px] text-text-secondary">
                              As ISOs listadas acima foram indexadas dos storages ativos do virtualizador.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {wizardStep === 4 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="block text-text-secondary text-xs font-bold uppercase tracking-wider">
                            Configuração de Armazenamento (Discos Virtuais)
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const defaultStorage = availableStorages[0]?.name || "local-lvm";
                              setWizardDisks([...wizardDisks, { storage: defaultStorage, size: 40 }]);
                            }}
                            className="flex items-center gap-1.5 text-xs text-blue-500 font-semibold hover:text-blue-400 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Adicionar Disco</span>
                          </button>
                        </div>

                        {loadingHvDetails ? (
                          <div className="py-12 flex flex-col items-center justify-center gap-3">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            <p className="text-text-secondary text-xs">Carregando storages compatíveis...</p>
                          </div>
                        ) : availableStorages.length === 0 ? (
                          <div className="p-6 text-center bg-red-500/5 border border-red-500/10 rounded-xl text-red-400 text-xs">
                            Aviso: Nenhum storage pool que aceite imagens de VM foi detectado no hipervisor.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {wizardDisks.map((disk, idx) => (
                              <div key={idx} className="p-4 bg-bg-primary/50 border border-border-color rounded-xl flex items-end gap-4">
                                <div className="flex-1 space-y-2">
                                  <span className="block text-[10px] font-bold text-text-secondary uppercase">
                                    Disco #{idx + 1}
                                  </span>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-[10px] text-text-secondary mb-1">Destino (Storage)</label>
                                      <select
                                        value={disk.storage}
                                        onChange={(e) => {
                                          const updated = [...wizardDisks];
                                          updated[idx].storage = e.target.value;
                                          setWizardDisks(updated);
                                        }}
                                        className="w-full px-3 py-1.5 bg-input-bg border border-input-border rounded-lg text-text-primary text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
                                      >
                                        {(() => {
                                          const selectedNodeData = availableNodes.find((n: any) => n.name === selectedNodeForWizard);
                                          const nodeStorages: any[] = selectedNodeData?.storages?.length > 0
                                            ? selectedNodeData.storages
                                            : availableStorages;
                                          const formatBytes = (bytes?: number) => {
                                            if (!bytes) return "";
                                            const gb = bytes / (1024 ** 3);
                                            return gb >= 1024 ? `${(gb / 1024).toFixed(1)} TB` : `${gb.toFixed(0)} GB`;
                                          };
                                          return nodeStorages.map((s: any) => {
                                            const avail = s.avail;
                                            const total = s.total ?? s.size;
                                            const capacityText = avail && total
                                              ? ` — ${formatBytes(avail)} livres de ${formatBytes(total)}`
                                              : "";
                                            return (
                                              <option key={s.name} value={s.name}>
                                                {s.name} ({s.type}){capacityText}
                                              </option>
                                            );
                                          });
                                        })()}
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] text-text-secondary mb-1">Tamanho (GB)</label>
                                      <input
                                        type="number"
                                        min={1}
                                        required
                                        value={disk.size}
                                        onChange={(e) => {
                                          const updated = [...wizardDisks];
                                          updated[idx].size = parseInt(e.target.value) || 0;
                                          setWizardDisks(updated);
                                        }}
                                        className="w-full px-3 py-1.5 bg-input-bg border border-input-border rounded-lg text-text-primary text-xs focus:outline-none focus:border-blue-500"
                                      />
                                    </div>
                                  </div>
                                </div>
                                
                                {wizardDisks.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWizardDisks(wizardDisks.filter((_, i) => i !== idx));
                                    }}
                                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
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
                  {selectedTemplateId ? (
                    <button
                      type="button"
                      onClick={handleCreateVM}
                      disabled={wizardLoading || !vmName.trim() || !selectedHvForWizard}
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
                  ) : (
                    <>
                      {wizardStep > 1 && (
                        <button
                          type="button"
                          onClick={() => setWizardStep(wizardStep - 1)}
                          className="px-4 py-2.5 border border-border-color hover:bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Voltar
                        </button>
                      )}

                      {wizardStep < 4 ? (
                        <button
                          type="button"
                          disabled={
                            (wizardStep === 1 && !selectedHvForWizard) ||
                            (wizardStep === 2 && !vmName)
                          }
                          onClick={() => {
                            if (wizardStep === 1) {
                              fetchHvDetails(selectedHvForWizard);
                            }
                            setWizardStep(wizardStep + 1);
                          }}
                          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>Próximo</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleCreateVM}
                          disabled={wizardLoading || wizardDisks.some(d => !d.storage || d.size <= 0)}
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
                    </>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmVmId && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-bg-secondary border border-border-color rounded-2xl w-full max-w-md shadow-2xl relative p-6 animate-scale-up space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-500/10 text-red-500 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">Confirmar Exclusão</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Tem certeza de que deseja excluir permanentemente esta máquina virtual? Esta ação é irreversível e todos os discos virtuais associados serão destruídos.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmVmId(null)}
                className="px-4 py-2 border border-border-color hover:bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={actionLoadingId === deleteConfirmVmId}
                onClick={() => handleDeleteVM(deleteConfirmVmId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {actionLoadingId === deleteConfirmVmId ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deletando...</span>
                  </>
                ) : (
                  <span>Deletar Máquina</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit VM Hardware Modal */}
      {editModalOpen && editingVm && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-border-color rounded-2xl w-full max-w-lg shadow-2xl relative animate-scale-up">
            {/* Modal Header */}
            <div className="p-6 border-b border-border-color flex items-center justify-between">
              <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" />
                Editar Hardware da VM
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingVm(null);
                }}
                className="text-text-secondary hover:text-text-primary text-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Nome da VM</label>
                  <input
                    type="text"
                    required
                    value={editVmName}
                    onChange={(e) => setEditVmName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500 text-sm transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">CPU Cores</label>
                    <select
                      value={editVmCpu}
                      onChange={(e) => setEditVmCpu(parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value={1}>1 Core</option>
                      <option value={2}>2 Cores</option>
                      <option value={4}>4 Cores</option>
                      <option value={8}>8 Cores</option>
                      <option value={16}>16 Cores</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">RAM (MB)</label>
                    <select
                      value={editVmMemory}
                      onChange={(e) => setEditVmMemory(parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-input-bg border border-input-border rounded-xl text-text-primary text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value={512}>512 MB</option>
                      <option value={1024}>1 GB (1024MB)</option>
                      <option value={2048}>2 GB (2048MB)</option>
                      <option value={4096}>4 GB (4096MB)</option>
                      <option value={8192}>8 GB (8192MB)</option>
                      <option value={16384}>16 GB (16384MB)</option>
                      <option value={32768}>32 GB (32768MB)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Endereço IP (Manual / Opcional)</label>
                  <input
                    type="text"
                    value={editVmIpAddress}
                    onChange={(e) => setEditVmIpAddress(e.target.value)}
                    placeholder="Ex: 192.168.1.50"
                    className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500 text-sm transition-colors"
                  />
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-text-secondary leading-relaxed flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Aviso de Reinicialização:</strong> Alterações de CPU e memória RAM podem requerer o reinício da máquina virtual para serem totalmente reconhecidas pelo sistema operacional convidado.
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-border-color flex justify-end gap-2 bg-bg-primary/50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setEditModalOpen(false);
                    setEditingVm(null);
                  }}
                  className="px-4 py-2 border border-border-color hover:bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {editLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Alterações</span>
                  )}
                </button>
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
                <div className="flex-1 flex flex-col min-h-0">
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
