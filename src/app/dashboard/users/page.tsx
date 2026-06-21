"use client";
import React, { useState, useEffect } from "react";
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Shield,
  Key,
  ShieldAlert,
  Server
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

interface HypervisorNode {
  id: string;
  name: string;
  type: string;
}

interface UserPermission {
  hypervisorId: string;
  access: string; // "FULL", "CONTROL", "VIEW"
  hypervisor?: HypervisorNode;
}

interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  role: "ADMIN" | "OPERATOR" | "VIEWER";
  createdAt: string;
  permissions: UserPermission[];
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [hypervisors, setHypervisors] = useState<HypervisorNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Modal & Edit states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Confirm Modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean,
    userId: string
  }>({ isOpen: false, userId: "" });

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "OPERATOR" | "VIEWER">("OPERATOR");
  // Dictionary: { [hypervisorId]: "NONE" | "VIEW" | "CONTROL" | "FULL" }
  const [userPermissions, setUserPermissions] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, hvRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/hypervisors")
      ]);

      const usersData = await usersRes.json();
      const hvData = await hvRes.json();

      if (usersRes.ok && hvRes.ok) {
        setUsers(usersData.users || []);
        setHypervisors(hvData.hypervisors || []);
      } else {
        setError(usersData.error || hvData.error || "Erro ao carregar dados administrativos.");
      }
    } catch (err) {
      setError("Erro de conexão ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setRole("OPERATOR");
    
    // Initialize permission dictionary
    const initialPerms: Record<string, string> = {};
    hypervisors.forEach(h => {
      initialPerms[h.id] = "NONE";
    });
    setUserPermissions(initialPerms);
    
    setEditingId(null);
    setError("");
  };

  const handleOpenAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (u: User) => {
    setError("");
    setEditingId(u.id);
    setName(u.name);
    setEmail(u.email);
    setPassword(""); // Keep blank to not change password
    setRole(u.role);

    // Load user permissions into state
    const perms: Record<string, string> = {};
    // Default all to NONE
    hypervisors.forEach(h => {
      perms[h.id] = "NONE";
    });
    // Overlay user permissions
    u.permissions.forEach(p => {
      perms[p.hypervisorId] = p.access;
    });

    setUserPermissions(perms);
    setIsModalOpen(true);
  };

  const handlePermissionChange = (hvId: string, accessLevel: string) => {
    setUserPermissions(prev => ({
      ...prev,
      [hvId]: accessLevel
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setSubmitLoading(true);

    // Parse permission state dictionary into payload array [{ hypervisorId, access }]
    const permissionsPayload = Object.entries(userPermissions)
      .filter(([_, access]) => access !== "NONE")
      .map(([hvId, access]) => ({
        hypervisorId: hvId,
        access
      }));

    try {
      const url = editingId 
        ? `/api/admin/users/${editingId}` 
        : "/api/admin/users";
      const method = editingId ? "PATCH" : "POST";

      const bodyPayload: any = {
        name,
        email,
        role,
        permissions: permissionsPayload
      };
      
      // Send password only if non-empty (required for new user, optional for edit)
      if (password) {
        bodyPayload.password = password;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ocorreu um erro ao salvar o usuário.");
      } else {
        setSuccessMsg(editingId ? "Usuário atualizado com sucesso!" : "Usuário cadastrado com sucesso!");
        setIsModalOpen(false);
        resetForm();
        fetchData();
        setTimeout(() => setSuccessMsg(""), 4000);
      }
    } catch (err) {
      setError("Erro de comunicação ao salvar usuário.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const openDeleteConfirm = (id: string) => {
    setConfirmDialog({ isOpen: true, userId: id });
  };

  const executeDelete = async () => {
    const id = confirmDialog.userId;
    setConfirmDialog({ isOpen: false, userId: "" });
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setSuccessMsg("Usuário excluído com sucesso.");
        fetchData();
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        const data = await res.json();
        setError(data.error || "Falha ao excluir usuário.");
      }
    } catch (err) {
      setError("Erro de rede ao deletar usuário.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Usuários e Permissões</h1>
          <p className="text-text-secondary mt-1">Gerencie credenciais de login e o escopo de acesso por hipervisor.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-medium transition-colors cursor-pointer shadow-lg shadow-blue-900/10 dark:shadow-blue-900/30"
        >
          <Plus className="w-5 h-5" />
          <span>Novo Usuário</span>
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

      {/* Users Table */}
      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-bg-secondary border border-border-color p-12 text-center rounded-2xl">
          <Users className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-text-primary font-bold text-lg">Nenhum usuário cadastrado</h3>
          <p className="text-text-secondary text-sm mt-1">Crie contas secundárias para operadores e visualizadores.</p>
        </div>
      ) : (
        <div className="bg-bg-secondary border border-border-color rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[10px] uppercase font-bold text-text-secondary tracking-wider bg-bg-primary/45 border-b border-border-color">
                <tr>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">E-mail</th>
                  <th className="px-6 py-4">Nível de Papel</th>
                  <th className="px-6 py-4">Permissões de Nós</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-bg-tertiary/10 transition-colors">
                    <td className="px-6 py-4 text-text-primary font-semibold whitespace-nowrap">{u.name}</td>
                    <td className="px-6 py-4 text-text-secondary">{u.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-max ${
                        u.role === "ADMIN" 
                          ? "bg-purple-500/10 text-purple-500 border border-purple-500/20" 
                          : u.role === "OPERATOR"
                          ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                          : "bg-bg-tertiary text-text-secondary border border-border-color"
                      }`}>
                        <Shield className="w-3.5 h-3.5" />
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-text-secondary max-w-sm">
                      {u.role === "ADMIN" ? (
                        <span className="text-purple-500 text-xs font-medium">Acesso Total (Ilimitado)</span>
                      ) : u.permissions.length === 0 ? (
                        <span className="text-text-muted text-xs italic">Sem nós atribuídos</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {u.permissions.map((p, idx) => (
                            <span 
                              key={idx} 
                              className="text-[10px] font-semibold bg-bg-primary border border-border-color px-2 py-0.5 rounded text-text-secondary"
                            >
                              {p.hypervisor ? p.hypervisor.name : `Nó deletado`} 
                              <strong className="text-blue-500 ml-1">({p.access})</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenEditModal(u)}
                        className="p-2 bg-bg-primary hover:bg-bg-tertiary border border-border-color text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer"
                        title="Editar Usuário"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {u.username !== "admin" && (
                        <button
                          onClick={() => openDeleteConfirm(u.id)}
                          className="p-2 bg-bg-primary hover:bg-red-500/10 border border-border-color hover:border-red-500/30 text-text-secondary hover:text-red-500 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          disabled={actionLoadingId === u.id}
                          title="Deletar Usuário"
                        >
                          {actionLoadingId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-border-color rounded-2xl w-full max-w-2xl shadow-2xl relative max-h-[90vh] flex flex-col animate-scale-up">
            {/* Modal Header */}
            <div className="p-6 border-b border-border-color">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-blue-500" />
                {editingId ? "Editar Usuário" : "Novo Usuário"}
              </h2>
              <p className="text-text-secondary text-xs mt-1">
                Configure os dados básicos de identificação e selecione o papel de controle de recursos.
              </p>
            </div>

            {/* Modal Body (Scrollable if permissions list is long) */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Guilherme Azevedo"
                      className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">E-mail</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@nodecommander.com"
                      className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">
                      {editingId ? "Nova Senha (Opcional)" : "Senha de Acesso"}
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                      <input
                        type="password"
                        required={!editingId}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-4 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                      />
                    </div>
                    {editingId && (
                      <p className="text-[10px] text-text-muted mt-1">Deixe em branco para manter a senha atual.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Nível de Papel (Role)</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500 text-sm transition-colors cursor-pointer"
                    >
                      <option value="ADMIN">ADMIN (Acesso Geral)</option>
                      <option value="OPERATOR">OPERATOR (Gerenciar Máquinas)</option>
                      <option value="VIEWER">VIEWER (Apenas Visualização)</option>
                    </select>
                  </div>
                </div>

                {/* Scoped Node Permissions Section */}
                {role !== "ADMIN" && (
                  <div className="border-t border-border-color pt-5 mt-5 space-y-4">
                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <Server className="w-4 h-4 text-blue-500" />
                      Permissões de Acesso por Hipervisor
                    </h3>
                    <p className="text-text-secondary text-xs">
                      Atribua níveis específicos de controle para cada nó do Proxmox.
                    </p>

                    {hypervisors.length === 0 ? (
                      <div className="p-4 bg-bg-primary border border-border-color rounded-xl text-center text-xs text-text-muted">
                        Nenhum hipervisor cadastrado ainda para atribuir permissões.
                      </div>
                    ) : (
                      <div className="space-y-2 border border-border-color rounded-xl divide-y divide-border-color overflow-hidden bg-bg-primary">
                        {hypervisors.map((hv) => (
                          <div key={hv.id} className="p-4 flex items-center justify-between gap-4">
                            <div>
                              <span className="font-semibold text-text-primary text-sm block">{hv.name}</span>
                              <span className="text-[10px] font-bold text-text-secondary uppercase">{hv.type}</span>
                            </div>
                            <select
                              value={userPermissions[hv.id] || "NONE"}
                              onChange={(e) => handlePermissionChange(hv.id, e.target.value)}
                              className="px-3 py-1.5 bg-bg-secondary border border-border-color rounded-lg text-xs text-text-primary focus:outline-none focus:border-blue-500 cursor-pointer"
                            >
                              <option value="NONE">Sem Acesso</option>
                              <option value="VIEW">VIEW (Apenas Visualizar)</option>
                              <option value="CONTROL">CONTROL (Ligar/Desligar)</option>
                              <option value="FULL">FULL (Acesso Total / Criar / Deletar)</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-border-color flex justify-end gap-3 bg-bg-secondary/50 rounded-b-2xl mt-auto">
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
                    <span>Salvar Usuário</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title="Excluir Usuário"
        message="Deseja realmente excluir este usuário? Esta ação não pode ser desfeita."
        confirmText="Sim, excluir"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={executeDelete}
        onCancel={() => setConfirmDialog({ isOpen: false, userId: "" })}
      />
    </div>
  );
}
