"use client";

import React, { useState, useEffect } from "react";
import { 
  Activity, 
  Cpu, 
  Layers, 
  Plus, 
  Trash2, 
  Settings, 
  Save, 
  RotateCcw, 
  ArrowLeft, 
  ArrowRight, 
  Maximize2, 
  Minimize2, 
  Server, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  Eye, 
  Database,
  ExternalLink,
  ChevronRight,
  Edit3,
  GripVertical
} from "lucide-react";

interface VM {
  id: string;
  name: string;
  status: "RUNNING" | "STOPPED" | "PAUSED" | "UNKNOWN";
  cpu: number;
  memory: number;
  disk: number;
  ipAddress?: string;
  node?: string;
  cpuUsage?: number;
  memoryUsed?: number;
  uptime?: number;
  netIn?: number;
  netOut?: number;
  diskUsed?: number;
  cpuShares?: number;
  hypervisorId: string;
  hypervisorName: string;
  userAccess: string;
}

interface Widget {
  id: string;
  type: "vm_status" | "total_cpu" | "total_ram" | "top_cpu" | "top_ram" | "pinned_vm" | "running_list";
  title: string;
  w: number; // Column span: 1, 2, or 3
  config?: {
    vmId?: string;
  };
}

interface Dashboard {
  id: string;
  name: string;
  widgets: Widget[];
}

const DEFAULT_WIDGETS: Widget[] = [
  { id: "w1", type: "total_cpu", title: "Média de Uso de CPU", w: 1 },
  { id: "w2", type: "total_ram", title: "Média de Uso de RAM", w: 1 },
  { id: "w3", type: "vm_status", title: "Divisão de Status das VMs", w: 1 },
  { id: "w4", type: "top_cpu", title: "Top VMs por Uso de CPU", w: 2 },
  { id: "w5", type: "top_ram", title: "Top VMs por Uso de Memória", w: 1 },
  { id: "w6", type: "running_list", title: "Painel de VMs Ativas", w: 3 }
];

export default function MonitoringPage() {
  const [vms, setVms] = useState<VM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "realtime">("dashboard");
  
  // Custom Dashboards states
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState<string>("default");
  const [isEditing, setIsEditing] = useState(false);
  const [addWidgetModalOpen, setAddWidgetModalOpen] = useState(false);
  const [widgetToConfigure, setWidgetToConfigure] = useState<Widget | null>(null);

  // Modals for dashboard manager
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState("");

  // Drag and drop states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Fetch VM metrics
  const fetchMetrics = async () => {
    try {
      const res = await fetch("/api/monitoring/vms");
      const data = await res.json();
      if (res.ok) {
        setVms(data.vms || []);
        setError("");
      } else {
        setError(data.error || "Erro ao consultar métricas.");
      }
    } catch (err) {
      setError("Erro ao carregar métricas de monitoramento.");
    } finally {
      setLoading(false);
    }
  };

  // Poll metrics every 4 seconds in real-time
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 4000);
    return () => clearInterval(interval);
  }, []);

  // Load dashboards from localStorage or set defaults
  useEffect(() => {
    const savedDashboards = localStorage.getItem("nodecommander_dashboards");
    const savedActiveId = localStorage.getItem("nodecommander_active_dashboard_id");

    const defaultDash: Dashboard = {
      id: "default",
      name: "Monitoramento Geral",
      widgets: DEFAULT_WIDGETS
    };

    if (savedDashboards) {
      try {
        const parsed = JSON.parse(savedDashboards);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDashboards(parsed);
          if (savedActiveId && parsed.some(d => d.id === savedActiveId)) {
            setActiveDashboardId(savedActiveId);
          } else {
            setActiveDashboardId(parsed[0].id);
          }
        } else {
          setDashboards([defaultDash]);
          setActiveDashboardId("default");
        }
      } catch (e) {
        setDashboards([defaultDash]);
        setActiveDashboardId("default");
      }
    } else {
      setDashboards([defaultDash]);
      setActiveDashboardId("default");
    }
  }, []);

  const activeDashboard = dashboards.find(d => d.id === activeDashboardId) || dashboards[0] || { id: "default", name: "Monitoramento Geral", widgets: DEFAULT_WIDGETS };
  const activeWidgets = activeDashboard.widgets;

  // Save current widgets configuration
  const updateWidgets = (updatedWidgets: Widget[]) => {
    const updatedDashboards = dashboards.map(d => {
      if (d.id === activeDashboardId) {
        return { ...d, widgets: updatedWidgets };
      }
      return d;
    });
    setDashboards(updatedDashboards);
    localStorage.setItem("nodecommander_dashboards", JSON.stringify(updatedDashboards));
  };

  const handleCreateDashboard = () => {
    if (!newDashboardName.trim()) return;
    const newDash: Dashboard = {
      id: `dash_${Date.now()}`,
      name: newDashboardName.trim(),
      widgets: DEFAULT_WIDGETS
    };
    const updated = [...dashboards, newDash];
    setDashboards(updated);
    setActiveDashboardId(newDash.id);
    localStorage.setItem("nodecommander_dashboards", JSON.stringify(updated));
    localStorage.setItem("nodecommander_active_dashboard_id", newDash.id);
    setCreateModalOpen(false);
    setNewDashboardName("");
  };

  const handleRenameDashboard = () => {
    if (!newDashboardName.trim() || activeDashboardId === "default") return;
    const updated = dashboards.map(d => {
      if (d.id === activeDashboardId) {
        return { ...d, name: newDashboardName.trim() };
      }
      return d;
    });
    setDashboards(updated);
    localStorage.setItem("nodecommander_dashboards", JSON.stringify(updated));
    setRenameModalOpen(false);
    setNewDashboardName("");
  };

  const handleDeleteDashboard = () => {
    if (activeDashboardId === "default") {
      alert("Não é possível excluir o painel padrão.");
      return;
    }
    if (confirm(`Deseja realmente excluir o painel "${activeDashboard.name}"?`)) {
      const updated = dashboards.filter(d => d.id !== activeDashboardId);
      setDashboards(updated);
      const nextActiveId = "default";
      setActiveDashboardId(nextActiveId);
      localStorage.setItem("nodecommander_dashboards", JSON.stringify(updated));
      localStorage.setItem("nodecommander_active_dashboard_id", nextActiveId);
    }
  };

  const handleResetLayout = () => {
    if (confirm("Deseja restaurar o layout padrão para este painel?")) {
      updateWidgets(DEFAULT_WIDGETS);
      setIsEditing(false);
    }
  };

  const handleAddWidget = (type: Widget["type"]) => {
    const titleMap: Record<Widget["type"], string> = {
      vm_status: "Divisão de Status das VMs",
      total_cpu: "Média de Uso de CPU",
      total_ram: "Média de Uso de RAM",
      top_cpu: "Top VMs por CPU",
      top_ram: "Top VMs por Uso de Memória",
      pinned_vm: "Destaque de VM específica",
      running_list: "Painel de VMs Ativas"
    };

    const newWidget: Widget = {
      id: `w_${Date.now()}`,
      type,
      title: titleMap[type],
      w: type === "running_list" ? 3 : type === "top_cpu" ? 2 : 1
    };

    const updated = [...activeWidgets, newWidget];
    updateWidgets(updated);
    setAddWidgetModalOpen(false);
  };

  const handleDeleteWidget = (id: string) => {
    const updated = activeWidgets.filter(w => w.id !== id);
    updateWidgets(updated);
  };

  const handleMoveWidget = (index: number, direction: "left" | "right") => {
    const updated = [...activeWidgets];
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < updated.length) {
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      updateWidgets(updated);
    }
  };

  const handleResizeWidget = (index: number, action: "grow" | "shrink") => {
    const updated = [...activeWidgets];
    const currentW = updated[index].w;
    if (action === "grow" && currentW < 3) {
      updated[index].w = currentW + 1;
    } else if (action === "shrink" && currentW > 1) {
      updated[index].w = currentW - 1;
    }
    updateWidgets(updated);
  };

  const handleConfigureWidget = (widget: Widget, vmId: string) => {
    const updated = activeWidgets.map(w => {
      if (w.id === widget.id) {
        return {
          ...w,
          config: { ...w.config, vmId }
        };
      }
      return w;
    });
    updateWidgets(updated);
    setWidgetToConfigure(null);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!isEditing) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", ""); // Firefox requirement
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (!isEditing) return;
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    if (!isEditing || draggedIndex === null) return;
    e.preventDefault();
    
    if (draggedIndex !== targetIndex) {
      const updated = [...activeWidgets];
      const [draggedItem] = updated.splice(draggedIndex, 1);
      updated.splice(targetIndex, 0, draggedItem);
      updateWidgets(updated);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Mouse Drag-to-Resize Handler
  const handleResizeStart = (e: React.MouseEvent, widgetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const element = e.currentTarget.parentElement;
    if (!element) return;
    const startWidth = element.getBoundingClientRect().width;
    
    const gridContainer = element.parentElement;
    if (!gridContainer) return;
    const gridWidth = gridContainer.getBoundingClientRect().width;
    const colWidth = gridWidth / 3; // base 3 columns

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = startWidth + deltaX;
      
      let newSpan = 1;
      if (newWidth > colWidth * 2.2) {
        newSpan = 3;
      } else if (newWidth > colWidth * 1.2) {
        newSpan = 2;
      }
      
      const updated = [...activeWidgets];
      if (updated[widgetIndex].w !== newSpan) {
        updated[widgetIndex].w = newSpan;
        updateWidgets(updated);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Telemetry aggregates
  const runningVMs = vms.filter(v => v.status === "RUNNING");
  const pausedVMs = vms.filter(v => v.status === "PAUSED");
  const stoppedVMs = vms.filter(v => v.status === "STOPPED");

  const averageCpu = runningVMs.length > 0
    ? Math.round(runningVMs.reduce((sum, v) => sum + (v.cpuUsage || 0), 0) / runningVMs.length)
    : 0;

  const totalAllocatedRam = runningVMs.reduce((sum, v) => sum + v.memory, 0);
  const totalUsedRam = runningVMs.reduce((sum, v) => sum + (v.memoryUsed || 0), 0);
  const averageRamPercent = totalAllocatedRam > 0
    ? Math.round((totalUsedRam / totalAllocatedRam) * 100)
    : 0;

  const topCpuVMs = [...vms]
    .filter(v => v.status === "RUNNING")
    .sort((a, b) => (b.cpuUsage || 0) - (a.cpuUsage || 0))
    .slice(0, 5);

  const topRamVMs = [...vms]
    .filter(v => v.status === "RUNNING")
    .sort((a, b) => (b.memoryUsed || 0) - (a.memoryUsed || 0))
    .slice(0, 5);

  const formatSpeed = (bytesPerSec?: number): string => {
    if (bytesPerSec === undefined || bytesPerSec <= 0) return "0 B/s";
    if (bytesPerSec >= 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    if (bytesPerSec >= 1024) {
      return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
    }
    return `${bytesPerSec} B/s`;
  };

  const formatUptime = (seconds?: number): string => {
    if (!seconds || seconds <= 0) return "0m";
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || (d === 0 && h === 0)) parts.push(`${m}m`);
    return parts.join(" ");
  };

  return (
    <div className="space-y-8 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Monitoramento Real-Time</h1>
          <p className="text-text-secondary mt-1">Consumo agregado de recursos e painéis customizados.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-bg-secondary p-1 rounded-xl border border-border-color shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-xs transition-colors cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Dashboard Customizado</span>
          </button>
          <button
            onClick={() => setActiveTab("realtime")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-xs transition-colors cursor-pointer ${
              activeTab === "realtime"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>VMs em Detalhes</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Activity className="w-10 h-10 animate-pulse text-blue-500" />
          <span className="text-sm text-text-secondary font-medium">Coletando telemetria das instâncias...</span>
        </div>
      ) : activeTab === "realtime" ? (
        /* TAB 2: DETALHES EM TEMPO REAL */
        <div className="bg-bg-secondary border border-border-color rounded-2xl flex flex-col overflow-hidden">
          <div className="p-6 border-b border-border-color">
            <h2 className="font-bold text-text-primary text-lg">Métricas Ativas por VM</h2>
            <p className="text-text-muted text-xs mt-0.5">Uso de hardware em tempo real para instâncias ligadas.</p>
          </div>

          <div className="overflow-x-auto font-sans">
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] uppercase font-bold text-text-secondary tracking-wider bg-bg-primary/45 border-b border-border-color">
                <tr>
                  <th className="px-6 py-4">VM ID</th>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Hipervisor</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-center">Uso de CPU</th>
                  <th className="px-6 py-4 text-center">Memória Usada</th>
                  <th className="px-6 py-4 text-center">Armazenamento</th>
                  <th className="px-6 py-4 text-center">Rede (Entrada/Saída)</th>
                  <th className="px-6 py-4 text-center">Tempo Ativa</th>
                  <th className="px-6 py-4">Endereço IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {vms.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-text-muted italic">
                      Nenhuma máquina virtual encontrada nos hipervisores ativos.
                    </td>
                  </tr>
                ) : (
                  vms.map((vm) => {
                    const isRunning = vm.status === "RUNNING";
                    return (
                      <tr key={`${vm.hypervisorId}-${vm.id}`} className="hover:bg-bg-tertiary/20 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-text-secondary">{vm.id}</td>
                        <td className="px-6 py-4 font-bold text-text-primary">{vm.name}</td>
                        <td className="px-6 py-4 text-xs text-text-secondary">
                          <span className="inline-flex items-center gap-1.5">
                            <Server className="w-3.5 h-3.5 text-text-muted" />
                            {vm.hypervisorName}
                          </span>
                        </td>
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
                        {/* CPU usage progress bar */}
                        <td className="px-6 py-4 text-center whitespace-nowrap min-w-[120px]">
                          {isRunning ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-semibold text-text-primary">{vm.cpuUsage || 0}%</span>
                              <div className="w-20 bg-bg-primary h-2 rounded-full overflow-hidden border border-border-color">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    (vm.cpuUsage || 0) > 75 ? "bg-red-500" : (vm.cpuUsage || 0) > 50 ? "bg-amber-500" : "bg-emerald-500"
                                  }`} 
                                  style={{ width: `${vm.cpuUsage || 0}%` }}
                                ></div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-text-muted text-xs italic">-</span>
                          )}
                        </td>
                        {/* RAM usage progress bar */}
                        <td className="px-6 py-4 text-center whitespace-nowrap min-w-[130px]">
                          {isRunning ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-semibold text-text-primary">
                                {vm.memoryUsed || 0} MB <span className="text-text-muted font-normal">/ {vm.memory} MB</span>
                              </span>
                              <div className="w-20 bg-bg-primary h-2 rounded-full overflow-hidden border border-border-color">
                                <div 
                                  className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                                  style={{ width: `${Math.round(((vm.memoryUsed || 0) / vm.memory) * 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-text-muted text-xs italic">-</span>
                          )}
                        </td>
                        {/* Storage usage progress bar */}
                        <td className="px-6 py-4 text-center whitespace-nowrap min-w-[130px]">
                          {vm.disk ? (
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-semibold text-text-primary">
                                {vm.diskUsed || 0} GB <span className="text-text-muted font-normal">/ {vm.disk} GB</span>
                              </span>
                              <div className="w-20 bg-bg-primary h-2 rounded-full overflow-hidden border border-border-color">
                                <div 
                                  className="bg-indigo-550 h-full rounded-full transition-all duration-500" 
                                  style={{ width: `${Math.round(((vm.diskUsed || 0) / vm.disk) * 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-text-muted text-xs italic">-</span>
                          )}
                        </td>
                        {/* Network Speed */}
                        <td className="px-6 py-4 text-center whitespace-nowrap min-w-[160px]">
                          {isRunning ? (
                            <div className="flex flex-col items-center text-[10px] gap-0.5 font-bold font-mono">
                              <span className="text-emerald-500 flex items-center gap-1">
                                &uarr; {formatSpeed(vm.netIn)}
                              </span>
                              <span className="text-blue-500 flex items-center gap-1">
                                &darr; {formatSpeed(vm.netOut)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-text-muted text-xs italic">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-xs text-text-secondary whitespace-nowrap">
                          {isRunning ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-text-muted" />
                              {formatUptime(vm.uptime)}
                            </span>
                          ) : (
                            <span className="text-text-muted text-xs italic">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-text-secondary">
                          {vm.ipAddress ? (
                            <span className="text-blue-500 hover:underline inline-flex items-center gap-1 cursor-pointer">
                              {vm.ipAddress}
                              <ExternalLink className="w-3 h-3 text-text-muted" />
                            </span>
                          ) : (
                            <span className="text-text-muted italic">n/a</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TAB 1: CUSTOMIZABLE DASHBOARD */
        <div className="space-y-6">
          {/* Controls Bar for Dashboard layout */}
          <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-bg-secondary border border-border-color rounded-2xl gap-4">
            
            {/* Dashboard Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-text-secondary font-medium whitespace-nowrap">Painel:</span>
              <div className="relative">
                <select
                  value={activeDashboardId}
                  onChange={(e) => {
                    setActiveDashboardId(e.target.value);
                    localStorage.setItem("nodecommander_active_dashboard_id", e.target.value);
                  }}
                  className="bg-bg-primary border border-border-color text-text-primary text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer focus:border-blue-500 min-w-[200px]"
                >
                  {dashboards.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Action buttons for active dashboard profile */}
              <button
                onClick={() => {
                  setNewDashboardName("");
                  setCreateModalOpen(true);
                }}
                className="p-2 bg-bg-primary hover:bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary rounded-xl transition-colors cursor-pointer"
                title="Criar Novo Painel"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              {activeDashboardId !== "default" && (
                <>
                  <button
                    onClick={() => {
                      setNewDashboardName(activeDashboard.name);
                      setRenameModalOpen(true);
                    }}
                    className="p-2 bg-bg-primary hover:bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary rounded-xl transition-colors cursor-pointer"
                    title="Renomear Painel Ativo"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={handleDeleteDashboard}
                    className="p-2 bg-bg-primary hover:bg-red-500/10 border border-border-color text-red-500 hover:text-red-400 rounded-xl transition-colors cursor-pointer"
                    title="Excluir Painel Ativo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Layout Actions */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              {isEditing ? (
                <>
                  <button
                    onClick={() => setAddWidgetModalOpen(true)}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-lg shadow-blue-900/10 dark:shadow-blue-900/30"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar Widget</span>
                  </button>
                  <button
                    onClick={handleResetLayout}
                    className="flex items-center gap-1.5 bg-bg-primary hover:bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    title="Restaurar Layout Inicial"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Restaurar Padrão</span>
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-lg shadow-emerald-900/10 dark:shadow-emerald-900/30"
                  >
                    <Save className="w-4 h-4" />
                    <span>Concluir</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 bg-bg-secondary hover:bg-bg-tertiary border border-border-color text-text-primary px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer hover:border-border-color/85"
                >
                  <Settings className="w-4 h-4 text-blue-500 animate-spin-slow" />
                  <span>Personalizar Painel</span>
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Grid of Custom Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
            {activeWidgets.map((widget, index) => {
              let gridSpan = "col-span-1";
              if (widget.w === 2) gridSpan = "col-span-1 lg:col-span-2";
              if (widget.w === 3) gridSpan = "col-span-1 lg:col-span-3";

              const isDragged = draggedIndex === index;
              const isOver = dragOverIndex === index && draggedIndex !== index;

              return (
                <div 
                  key={widget.id} 
                  draggable={isEditing}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`relative bg-bg-secondary border rounded-2xl flex flex-col overflow-hidden transition-all duration-300 ${gridSpan} ${
                    isEditing 
                      ? "border-dashed border-blue-500/50 ring-2 ring-blue-500/5 bg-blue-500/[0.01] cursor-grab active:cursor-grabbing" 
                      : "border-border-color hover:border-border-color/80"
                  } ${isDragged ? "opacity-45 scale-[0.97] border-blue-600 bg-blue-600/5" : ""} ${
                    isOver ? "border-emerald-500/60 ring-4 ring-emerald-500/10 scale-[1.01]" : ""
                  }`}
                >
                  {/* Drag and Resize Grip overlays */}
                  {isEditing && (
                    <div
                      onMouseDown={(e) => handleResizeStart(e, index)}
                      className="absolute bottom-1 right-1 w-5 h-5 cursor-se-resize flex items-end justify-end p-0.5 text-text-muted hover:text-blue-500 transition-colors z-20"
                      title="Arraste para redimensionar"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" className="fill-current rotate-90 opacity-40 hover:opacity-100">
                        <path d="M10 0 L10 10 L0 10 Z" />
                      </svg>
                    </div>
                  )}

                  {/* Widget Header */}
                  <div className="p-4 border-b border-border-color flex items-center justify-between bg-bg-secondary/40 select-none">
                    <div className="flex items-center gap-2">
                      {isEditing && (
                        <GripVertical className="w-4 h-4 text-text-muted shrink-0 cursor-grab" />
                      )}
                      <div className="p-1 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-lg">
                        {widget.type === "total_cpu" ? (
                          <Cpu className="w-4 h-4" />
                        ) : widget.type === "total_ram" ? (
                          <Database className="w-4 h-4" />
                        ) : widget.type === "vm_status" ? (
                          <Layers className="w-4 h-4" />
                        ) : widget.type === "running_list" ? (
                          <Activity className="w-4 h-4" />
                        ) : (
                          <TrendingUp className="w-4 h-4" />
                        )}
                      </div>
                      <span className="font-bold text-text-primary text-sm tracking-wide">{widget.title}</span>
                    </div>

                    {/* Editor actions */}
                    {isEditing && (
                      <div className="flex items-center gap-1">
                        {/* Move actions */}
                        <button
                          disabled={index === 0}
                          onClick={() => handleMoveWidget(index, "left")}
                          className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-primary rounded transition-colors disabled:opacity-30 cursor-pointer"
                          title="Mover Esquerda"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={index === activeWidgets.length - 1}
                          onClick={() => handleMoveWidget(index, "right")}
                          className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-primary rounded transition-colors disabled:opacity-30 cursor-pointer"
                          title="Mover Direita"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        {/* Resize actions */}
                        <button
                          disabled={widget.w === 1}
                          onClick={() => handleResizeWidget(index, "shrink")}
                          className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-primary rounded transition-colors disabled:opacity-30 cursor-pointer"
                          title="Diminuir"
                        >
                          <Minimize2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={widget.w === 3}
                          onClick={() => handleResizeWidget(index, "grow")}
                          className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-primary rounded transition-colors disabled:opacity-30 cursor-pointer"
                          title="Aumentar"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Config action for pinned VM */}
                        {widget.type === "pinned_vm" && (
                          <button
                            onClick={() => setWidgetToConfigure(widget)}
                            className="p-1 text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors cursor-pointer"
                            title="Escolher VM Destaque"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete action */}
                        <button
                          onClick={() => handleDeleteWidget(widget.id)}
                          className="p-1 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer ml-1"
                          title="Excluir widget"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Widget Content Body */}
                  <div className="p-5 flex-1 flex flex-col justify-center min-h-[140px] bg-bg-secondary/15">
                    {widget.type === "total_cpu" && (
                      <div className="flex items-center justify-between py-2">
                        <div className="space-y-1">
                          <span className="text-3xl font-extrabold text-text-primary">{averageCpu}%</span>
                          <p className="text-xs text-text-muted">Uso médio de CPU do cluster ativo</p>
                        </div>
                        <div className="relative w-16 h-16 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="32" cy="32" r="28" className="stroke-border-color" strokeWidth="6" fill="transparent" />
                            <circle cx="32" cy="32" r="28" className="stroke-blue-600 transition-all duration-1000" strokeWidth="6" fill="transparent" 
                                    strokeDasharray={175} strokeDashoffset={175 - (175 * averageCpu) / 100} />
                          </svg>
                          <Cpu className="w-5 h-5 text-blue-500 absolute" />
                        </div>
                      </div>
                    )}

                    {widget.type === "total_ram" && (
                      <div className="flex items-center justify-between py-2">
                        <div className="space-y-1">
                          <span className="text-3xl font-extrabold text-text-primary">{averageRamPercent}%</span>
                          <p className="text-xs text-text-muted">
                            {totalUsedRam >= 1024 ? `${(totalUsedRam/1024).toFixed(1)} GB` : `${totalUsedRam} MB`} de {totalAllocatedRam >= 1024 ? `${(totalAllocatedRam/1024).toFixed(1)} GB` : `${totalAllocatedRam} MB`}
                          </p>
                        </div>
                        <div className="relative w-16 h-16 flex items-center justify-center">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="32" cy="32" r="28" className="stroke-border-color" strokeWidth="6" fill="transparent" />
                            <circle cx="32" cy="32" r="28" className="stroke-indigo-500 transition-all duration-1000" strokeWidth="6" fill="transparent" 
                                    strokeDasharray={175} strokeDashoffset={175 - (175 * averageRamPercent) / 100} />
                          </svg>
                          <Database className="w-5 h-5 text-indigo-500 absolute" />
                        </div>
                      </div>
                    )}

                    {widget.type === "vm_status" && (
                      <div className="space-y-3 py-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-text-secondary font-medium">Divisão por Estado:</span>
                          <span className="font-bold text-text-primary">{vms.length} VMs no Total</span>
                        </div>
                        <div className="flex h-3 bg-bg-primary rounded-full overflow-hidden border border-border-color">
                          <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${vms.length > 0 ? (runningVMs.length / vms.length) * 100 : 0}%` }} title="Ativas"></div>
                          <div className="bg-amber-500 transition-all duration-500" style={{ width: `${vms.length > 0 ? (pausedVMs.length / vms.length) * 100 : 0}%` }} title="Pausadas"></div>
                          <div className="bg-text-muted/50 transition-all duration-500" style={{ width: `${vms.length > 0 ? (stoppedVMs.length / vms.length) * 100 : 0}%` }} title="Desligadas"></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-text-muted font-bold tracking-wide">
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> {runningVMs.length} Ligadas</span>
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> {pausedVMs.length} Pausadas</span>
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-text-muted/50"></span> {stoppedVMs.length} Desligadas</span>
                        </div>
                      </div>
                    )}

                    {widget.type === "top_cpu" && (
                      <div className="space-y-2 py-1">
                        {topCpuVMs.length === 0 ? (
                          <p className="text-xs text-text-muted italic text-center py-4">Nenhuma VM ativa no momento.</p>
                        ) : (
                          topCpuVMs.map(vm => (
                            <div key={`topcpu-${vm.hypervisorId}-${vm.id}`} className="flex items-center justify-between text-xs py-1 border-b border-border-color/40 last:border-0">
                              <span className="font-semibold text-text-primary truncate max-w-[150px]">{vm.name}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-20 bg-bg-primary h-1.5 rounded-full overflow-hidden border border-border-color">
                                  <div className="bg-blue-500 h-full rounded-full" style={{ width: `${vm.cpuUsage || 0}%` }}></div>
                                </div>
                                <span className="font-mono text-text-secondary font-bold text-[10px] w-8 text-right">{vm.cpuUsage || 0}%</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {widget.type === "top_ram" && (
                      <div className="space-y-2 py-1">
                        {topRamVMs.length === 0 ? (
                          <p className="text-xs text-text-muted italic text-center py-4">Nenhuma VM ativa no momento.</p>
                        ) : (
                          topRamVMs.map(vm => (
                            <div key={`topram-${vm.hypervisorId}-${vm.id}`} className="flex items-center justify-between text-xs py-1 border-b border-border-color/40 last:border-0">
                              <span className="font-semibold text-text-primary truncate max-w-[120px]">{vm.name}</span>
                              <span className="font-mono text-[10px] text-text-secondary font-bold">
                                {vm.memoryUsed || 0} <span className="text-text-muted font-normal">/ {vm.memory} MB</span>
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {widget.type === "pinned_vm" && (() => {
                      const selectedVm = vms.find(v => v.id === widget.config?.vmId);
                      if (!selectedVm) {
                        return (
                          <div className="flex flex-col items-center justify-center text-center py-4">
                            <Eye className="w-7 h-7 text-text-muted mb-2 animate-bounce-slow" />
                            <p className="text-xs text-text-muted">Nenhuma VM selecionada para monitoramento.</p>
                            {isEditing && (
                              <button
                                onClick={() => setWidgetToConfigure(widget)}
                                className="mt-2 text-xs text-blue-500 font-bold hover:underline"
                              >
                                Escolher Máquina
                              </button>
                            )}
                          </div>
                        );
                      }

                      const isRunning = selectedVm.status === "RUNNING";
                      return (
                        <div className="space-y-4 py-1 text-xs">
                          {/* Top Info */}
                          <div className="flex justify-between items-center pb-2 border-b border-border-color/40">
                            <div>
                              <span className="font-bold text-text-primary text-sm block">{selectedVm.name}</span>
                              <span className="text-[10px] text-text-secondary font-mono">Nó: {selectedVm.node || selectedVm.hypervisorName} &bull; ID: {selectedVm.id}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                              isRunning 
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                                : "bg-bg-tertiary text-text-secondary border-border-color"
                            }`}>{isRunning ? "ATIVO" : "INATIVO"}</span>
                          </div>

                          {isRunning ? (
                            <div className="grid grid-cols-2 gap-3">
                              {/* CPU info */}
                              <div className="p-3 bg-bg-primary rounded-xl border border-border-color space-y-1">
                                <span className="text-[10px] text-text-muted font-bold tracking-wide uppercase">CPU</span>
                                <div className="flex items-baseline justify-between">
                                  <span className="text-sm font-extrabold text-text-primary">{selectedVm.cpuUsage || 0}%</span>
                                  <span className="text-[9px] text-text-secondary font-mono">{selectedVm.cpu} vCPUs</span>
                                </div>
                                <div className="text-[9px] text-text-muted">Min Shares: {selectedVm.cpuShares || 1024}</div>
                              </div>

                              {/* RAM info */}
                              <div className="p-3 bg-bg-primary rounded-xl border border-border-color space-y-1">
                                <span className="text-[10px] text-text-muted font-bold tracking-wide uppercase">RAM (Memória)</span>
                                <div className="flex items-baseline justify-between">
                                  <span className="text-sm font-extrabold text-text-primary">{selectedVm.memoryUsed || 0} MB</span>
                                  <span className="text-[9px] text-text-secondary font-mono">/ {selectedVm.memory} MB</span>
                                </div>
                                <div className="w-full bg-bg-secondary h-1 rounded-full overflow-hidden">
                                  <div className="bg-blue-500 h-full" style={{ width: `${Math.round(((selectedVm.memoryUsed || 0) / selectedVm.memory) * 100)}%` }}></div>
                                </div>
                              </div>

                              {/* Network traffic info */}
                              <div className="p-3 bg-bg-primary rounded-xl border border-border-color space-y-1 col-span-2">
                                <span className="text-[10px] text-text-muted font-bold tracking-wide uppercase block">Tráfego de Rede (E/S)</span>
                                <div className="flex justify-between items-center text-xs">
                                  <span className="flex items-center gap-1 text-emerald-500 font-semibold font-mono text-[10px]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-550 animate-pulse"></span>
                                    Entrada (In): {formatSpeed(selectedVm.netIn)}
                                  </span>
                                  <span className="flex items-center gap-1 text-blue-500 font-semibold font-mono text-[10px]">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-550 animate-pulse"></span>
                                    Saída (Out): {formatSpeed(selectedVm.netOut)}
                                  </span>
                                </div>
                              </div>

                              {/* Storage info */}
                              <div className="p-3 bg-bg-primary rounded-xl border border-border-color space-y-1 col-span-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-text-muted font-bold tracking-wide uppercase">Armazenamento</span>
                                  <span className="text-[10px] text-text-secondary font-bold">{selectedVm.diskUsed || 0} GB / {selectedVm.disk} GB</span>
                                </div>
                                <div className="w-full bg-bg-secondary h-1.5 rounded-full overflow-hidden border border-border-color">
                                  <div className="bg-indigo-500 h-full" style={{ width: `${Math.round(((selectedVm.diskUsed || 0) / selectedVm.disk) * 100)}%` }}></div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-6 bg-bg-primary rounded-xl border border-border-color border-dashed">
                              <AlertCircle className="w-5 h-5 text-text-muted mb-1" />
                              <p className="text-text-muted text-[11px] italic">Máquina virtual offline. Telemetria indisponível.</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {widget.type === "running_list" && (
                      <div className="overflow-x-auto py-1">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-[9px] uppercase font-bold text-text-muted tracking-wider border-b border-border-color">
                              <th className="pb-2">VM</th>
                              <th className="pb-2">Nó</th>
                              <th className="pb-2 text-center">Uso de CPU</th>
                              <th className="pb-2 text-center">Memória</th>
                              <th className="pb-2 text-center">Tempo Ativa</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-color/45">
                            {runningVMs.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-4 text-center text-text-muted italic">Nenhuma VM ativa detectada.</td>
                              </tr>
                            ) : (
                              runningVMs.slice(0, 4).map(vm => (
                                <tr key={`runninglist-${vm.hypervisorId}-${vm.id}`} className="hover:bg-bg-primary/30">
                                  <td className="py-2 font-bold text-text-primary">{vm.name}</td>
                                  <td className="py-2 text-[10px] text-text-secondary">{vm.hypervisorName}</td>
                                  <td className="py-2 text-center">
                                    <span className="font-bold text-text-primary">{vm.cpuUsage || 0}%</span>
                                  </td>
                                  <td className="py-2 text-center font-medium">
                                    {vm.memoryUsed || 0} MB <span className="text-text-muted text-[10px]">/ {vm.memory} MB</span>
                                  </td>
                                  <td className="py-2 text-center text-text-secondary">
                                    {formatUptime(vm.uptime)}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: ADICIONAR WIDGET */}
      {addWidgetModalOpen && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-border-color rounded-2xl w-full max-w-lg shadow-2xl relative animate-scale-up overflow-hidden">
            <div className="p-6 border-b border-border-color">
              <h3 className="text-lg font-bold text-text-primary">Escolha um Widget</h3>
              <p className="text-xs text-text-muted mt-0.5">Selecione o elemento para adicionar ao seu dashboard.</p>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto">
              <button
                onClick={() => handleAddWidget("total_cpu")}
                className="flex items-start gap-3 p-4 bg-bg-primary hover:bg-bg-tertiary border border-border-color rounded-xl text-left cursor-pointer transition-colors"
              >
                <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-lg mt-0.5">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-sm text-text-primary block">Média de CPU</span>
                  <span className="text-[11px] text-text-secondary leading-relaxed block mt-1">Consumo agregado de CPU de todas as VMs ativas.</span>
                </div>
              </button>

              <button
                onClick={() => handleAddWidget("total_ram")}
                className="flex items-start gap-3 p-4 bg-bg-primary hover:bg-bg-tertiary border border-border-color rounded-xl text-left cursor-pointer transition-colors"
              >
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 rounded-lg mt-0.5">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-sm text-text-primary block">Média de RAM</span>
                  <span className="text-[11px] text-text-secondary leading-relaxed block mt-1">Consumo de memória RAM agregada em tempo real.</span>
                </div>
              </button>

              <button
                onClick={() => handleAddWidget("vm_status")}
                className="flex items-start gap-3 p-4 bg-bg-primary hover:bg-bg-tertiary border border-border-color rounded-xl text-left cursor-pointer transition-colors"
              >
                <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-500 rounded-lg mt-0.5">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-sm text-text-primary block">Divisão de Status</span>
                  <span className="text-[11px] text-text-secondary leading-relaxed block mt-1">Proporção e contagem de VMs ligadas, desligadas ou suspensas.</span>
                </div>
              </button>

              <button
                onClick={() => handleAddWidget("top_cpu")}
                className="flex items-start gap-3 p-4 bg-bg-primary hover:bg-bg-tertiary border border-border-color rounded-xl text-left cursor-pointer transition-colors"
              >
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg mt-0.5">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-sm text-text-primary block">Top VMs por CPU</span>
                  <span className="text-[11px] text-text-secondary leading-relaxed block mt-1">Leaderboard das 5 VMs consumindo mais processamento.</span>
                </div>
              </button>

              <button
                onClick={() => handleAddWidget("top_ram")}
                className="flex items-start gap-3 p-4 bg-bg-primary hover:bg-bg-tertiary border border-border-color rounded-xl text-left cursor-pointer transition-colors"
              >
                <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg mt-0.5">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-sm text-text-primary block">Top VMs por RAM</span>
                  <span className="text-[11px] text-text-secondary leading-relaxed block mt-1">Leaderboard das 5 VMs com maior alocação/uso de memória.</span>
                </div>
              </button>

              <button
                onClick={() => handleAddWidget("pinned_vm")}
                className="flex items-start gap-3 p-4 bg-bg-primary hover:bg-bg-tertiary border border-border-color rounded-xl text-left cursor-pointer transition-colors"
              >
                <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-lg mt-0.5">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-sm text-text-primary block">VM Destacada</span>
                  <span className="text-[11px] text-text-secondary leading-relaxed block mt-1">Fixa uma VM específica para monitorar telemetria exclusiva.</span>
                </div>
              </button>

              <button
                onClick={() => handleAddWidget("running_list")}
                className="flex items-start gap-3 p-4 bg-bg-primary hover:bg-bg-tertiary border border-border-color rounded-xl text-left cursor-pointer transition-colors sm:col-span-2"
              >
                <div className="p-2 bg-pink-500/10 border border-pink-500/20 text-pink-500 rounded-lg mt-0.5">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-sm text-text-primary block">Lista de VMs Ativas</span>
                  <span className="text-[11px] text-text-secondary leading-relaxed block mt-1">Visão consolidada das instâncias atualmente ligadas e ativas.</span>
                </div>
              </button>
            </div>

            <div className="p-6 border-t border-border-color bg-bg-secondary/40 flex justify-end">
              <button
                onClick={() => setAddWidgetModalOpen(false)}
                className="bg-bg-primary hover:bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary px-4.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SELECIONAR VM DESTAQUE */}
      {widgetToConfigure && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-border-color rounded-2xl w-full max-w-md shadow-2xl relative animate-scale-up overflow-hidden">
            <div className="p-6 border-b border-border-color">
              <h3 className="text-lg font-bold text-text-primary">Configurar Widget</h3>
              <p className="text-xs text-text-muted mt-0.5">Selecione qual máquina virtual você deseja fixar neste widget.</p>
            </div>

            <div className="p-6 space-y-2 max-h-[300px] overflow-y-auto">
              {vms.length === 0 ? (
                <p className="text-xs text-text-muted italic text-center py-4">Nenhuma VM disponível.</p>
              ) : (
                vms.map(vm => (
                  <button
                    key={`config-select-${vm.hypervisorId}-${vm.id}`}
                    onClick={() => handleConfigureWidget(widgetToConfigure, vm.id)}
                    className="w-full flex items-center justify-between p-3 bg-bg-primary hover:bg-bg-tertiary border border-border-color rounded-xl text-left cursor-pointer transition-all hover:translate-x-0.5"
                  >
                    <div>
                      <span className="font-bold text-xs text-text-primary block">{vm.name}</span>
                      <span className="text-[10px] text-text-muted block mt-0.5">{vm.hypervisorName} &bull; ID {vm.id}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  </button>
                ))
              )}
            </div>

            <div className="p-6 border-t border-border-color bg-bg-secondary/40 flex justify-end">
              <button
                onClick={() => setWidgetToConfigure(null)}
                className="bg-bg-primary hover:bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary px-4.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CRIAR DASHBOARD */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-border-color rounded-2xl w-full max-w-sm shadow-2xl relative animate-scale-up overflow-hidden">
            <div className="p-6 border-b border-border-color">
              <h3 className="text-lg font-bold text-text-primary">Novo Painel</h3>
              <p className="text-xs text-text-muted mt-0.5">Escolha um nome descritivo para seu novo painel.</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Nome do Painel</label>
                <input
                  type="text"
                  placeholder="Ex: Monitorar VM de Banco"
                  value={newDashboardName}
                  onChange={(e) => setNewDashboardName(e.target.value)}
                  className="w-full bg-bg-primary border border-border-color text-text-primary text-xs font-medium px-4 py-2.5 rounded-xl outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-border-color bg-bg-secondary/40 flex justify-end gap-2">
              <button
                onClick={() => setCreateModalOpen(false)}
                className="bg-bg-primary hover:bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateDashboard}
                disabled={!newDashboardName.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40"
              >
                Criar Painel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RENOMEAR DASHBOARD */}
      {renameModalOpen && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-border-color rounded-2xl w-full max-w-sm shadow-2xl relative animate-scale-up overflow-hidden">
            <div className="p-6 border-b border-border-color">
              <h3 className="text-lg font-bold text-text-primary">Renomear Painel</h3>
              <p className="text-xs text-text-muted mt-0.5">Insira o novo nome para o painel selecionado.</p>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-secondary">Novo Nome</label>
                <input
                  type="text"
                  value={newDashboardName}
                  onChange={(e) => setNewDashboardName(e.target.value)}
                  className="w-full bg-bg-primary border border-border-color text-text-primary text-xs font-medium px-4 py-2.5 rounded-xl outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-border-color bg-bg-secondary/40 flex justify-end gap-2">
              <button
                onClick={() => setRenameModalOpen(false)}
                className="bg-bg-primary hover:bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRenameDashboard}
                disabled={!newDashboardName.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40"
              >
                Salvar Nome
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
