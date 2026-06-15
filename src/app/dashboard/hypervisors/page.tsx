"use client";
import React, { useState, useEffect } from "react";
import { 
  Server, 
  Plus, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Lock,
  Globe,
  Settings,
  ChevronDown
} from "lucide-react";

interface Hypervisor {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  username: string;
  credential?: string;
  status: "ONLINE" | "OFFLINE" | "UNKNOWN";
  nodeName: string;
  createdAt: string;
}

export default function HypervisorsPage() {
  const [hypervisors, setHypervisors] = useState<Hypervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  
  // Form states
  const [name, setName] = useState("");
  const [type, setType] = useState("PROXMOX");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(8006);
  const [username, setUsername] = useState("root@pam");
  const [credential, setCredential] = useState("");
  const [nodeName, setNodeName] = useState("pve");
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    fetchHypervisors();
  }, []);

  const fetchHypervisors = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/hypervisors");
      const data = await res.json();
      if (res.ok) {
        setHypervisors(data.hypervisors || []);
      } else {
        setError(data.error || "Falha ao carregar hipervisores.");
      }
    } catch (err) {
      setError("Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setType("PROXMOX");
    setHost("");
    setPort(8006);
    setUsername("root@pam");
    setCredential("");
    setNodeName("pve");
    setEditingId(null);
    setError("");
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (h: Hypervisor) => {
    setError("");
    setEditingId(h.id);
    setName(h.name);
    setType(h.type);
    setHost(h.host);
    setPort(h.port);
    setUsername(h.username);
    setCredential("[OCULTADO]"); // Masked
    setNodeName(h.nodeName);
    setIsModalOpen(true);
  };

  const handleTestConnection = async (idOrData: string | object) => {
    const isById = typeof idOrData === "string";
    if (isById) {
      setTestingId(idOrData);
    }
    
    try {
      const body = isById 
        ? { id: idOrData } 
        : idOrData;

      const res = await fetch("/api/admin/hypervisors/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (isById) {
          setSuccessMsg("Conexão estabelecida com sucesso!");
          fetchHypervisors(); // Refresh status in UI
        }
        return true;
      } else {
        const errorMsg = data.error || "Falha na conexão de teste.";
        if (isById) setError(errorMsg);
        return false;
      }
    } catch (err) {
      if (isById) setError("Erro de comunicação ao testar conexão.");
      return false;
    } finally {
      if (isById) {
        setTestingId(null);
        setTimeout(() => setSuccessMsg(""), 4000);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setSubmitLoading(true);

    try {
      const url = editingId 
        ? `/api/admin/hypervisors/${editingId}` 
        : "/api/admin/hypervisors";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          host,
          port,
          username,
          credential,
          nodeName
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ocorreu um erro ao salvar o hipervisor.");
      } else {
        setSuccessMsg(editingId ? "Hipervisor atualizado!" : "Hipervisor cadastrado!");
        setIsModalOpen(false);
        resetForm();
        fetchHypervisors();
        setTimeout(() => setSuccessMsg(""), 4000);
      }
    } catch (err) {
      setError("Erro de rede ao salvar.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente remover este hipervisor? Todas as permissões vinculadas serão apagadas.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/hypervisors/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setSuccessMsg("Hipervisor deletado.");
        fetchHypervisors();
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        const data = await res.json();
        setError(data.error || "Falha ao deletar.");
      }
    } catch (err) {
      setError("Erro ao deletar.");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Hipervisores</h1>
          <p className="text-text-secondary mt-1">Gerencie os nós de conexão e as configurações do Proxmox.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-medium transition-colors cursor-pointer shadow-lg shadow-blue-900/10 dark:shadow-blue-900/30 shrink-0"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Hipervisor</span>
        </button>
      </div>

      {/* Notices */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl flex items-start gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid List */}
      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : hypervisors.length === 0 ? (
        <div className="bg-bg-secondary border border-border-color p-12 text-center rounded-2xl">
          <Server className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-text-primary font-bold text-lg">Nenhum hipervisor cadastrado</h3>
          <p className="text-text-secondary text-sm mt-1 max-w-md mx-auto">
            Cadastre um nó de virtualizador para listar, gerenciar e criar suas máquinas virtuais no NodeCommander.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-6 px-4 py-2 text-xs font-semibold text-blue-500 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors cursor-pointer"
          >
            Começar agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hypervisors.map((h) => (
            <div key={h.id} className="bg-bg-secondary border border-border-color hover:border-border-color/80 transition-all rounded-2xl flex flex-col p-6 shadow-xl relative overflow-hidden group">
              {/* Pulsing Status Dot */}
              <div className="absolute top-6 right-6 flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                  h.status === "ONLINE" ? "text-emerald-500 dark:text-emerald-400" : h.status === "OFFLINE" ? "text-red-500 dark:text-red-400" : "text-text-muted"
                }`}>
                  {h.status}
                </span>
                <span className={`relative flex h-2 w-2`}>
                  {h.status === "ONLINE" && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  )}
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    h.status === "ONLINE" ? "bg-emerald-500" : h.status === "OFFLINE" ? "bg-red-500" : "bg-text-muted"
                  }`}></span>
                </span>
              </div>

              {/* Title & Info */}
              <div className="flex items-center gap-3.5 mb-5">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-xl">
                  <Server className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-text-primary text-lg truncate pr-16">{h.name}</h3>
                  <span className="text-[10px] font-bold bg-bg-tertiary px-2 py-0.5 border border-border-color text-text-secondary rounded">
                    {h.type}
                  </span>
                </div>
              </div>

              {/* Details table */}
              <div className="flex-1 space-y-2 text-sm text-text-secondary border-t border-border-color/60 pt-4 mb-6">
                <div className="flex justify-between">
                  <span>Endereço Host</span>
                  <span className="text-text-primary font-medium flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-text-muted" />
                    {h.host}:{h.port}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Usuário</span>
                  <span className="text-text-primary font-medium">{h.username}</span>
                </div>
                <div className="flex justify-between">
                  <span>Nome do Nó</span>
                  <span className="text-text-primary font-mono text-xs">{h.nodeName}</span>
                </div>
              </div>

              {/* Actions row */}
              <div className="flex gap-2 border-t border-border-color pt-4 mt-auto">
                <button
                  onClick={() => handleTestConnection(h.id)}
                  disabled={testingId === h.id}
                  className="flex-1 py-2 bg-bg-primary hover:bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {testingId === h.id ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                      <span>Testando...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Testar Conexão</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleOpenEditModal(h)}
                  title="Editar Hipervisor"
                  className="p-2 bg-bg-primary hover:bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDelete(h.id)}
                  title="Deletar Hipervisor"
                  className="p-2 bg-bg-primary hover:bg-red-500/10 border border-border-color hover:border-red-500/30 text-text-secondary hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation / Edition Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-border-color rounded-2xl w-full max-w-lg shadow-2xl relative animate-scale-up">
            {/* Modal Header */}
            <div className="p-6 border-b border-border-color">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-500" />
                {editingId ? "Editar Hipervisor" : "Cadastrar Hipervisor"}
              </h2>
              <p className="text-text-secondary text-xs mt-1">Configure as credenciais de autenticação e detalhes de endpoint.</p>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Nome</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Proxmox Core 1"
                      className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Tipo</label>
                    <div className="relative">
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="w-full appearance-none pr-10 px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500 text-sm transition-colors cursor-pointer"
                      >
                        <option value="PROXMOX">Proxmox VE</option>
                        <option value="VMWARE" disabled>VMware ESXi (Em breve)</option>
                        <option value="HYPERV" disabled>Hyper-V (Em breve)</option>
                      </select>
                      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Host (IP / FQDN)</label>
                    <input
                      type="text"
                      required
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="192.168.1.10 or mock"
                      className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Porta</label>
                    <input
                      type="number"
                      required
                      value={port}
                      onChange={(e) => setPort(parseInt(e.target.value))}
                      placeholder="8006"
                      className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Usuário</label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="root@pam"
                      className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Nome do Nó (Proxmox)</label>
                    <input
                      type="text"
                      required
                      value={nodeName}
                      onChange={(e) => setNodeName(e.target.value)}
                      placeholder="pve"
                      className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Senha ou Token de API</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                    <input
                      type="password"
                      required
                      value={credential}
                      onChange={(e) => setCredential(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-4 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                    />
                  </div>
                  <p className="text-[10px] text-text-muted mt-1.5">
                    No caso de Token, cole a chave de API diretamente. A credencial será criptografada.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-border-color flex justify-end gap-3 bg-bg-secondary/50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 border border-border-color hover:bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-blue-800"
                >
                  {submitLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Hipervisor</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
