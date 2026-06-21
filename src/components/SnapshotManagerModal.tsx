"use client";

import React, { useState, useEffect } from "react";
import { Camera, Trash2, RotateCcw, X, Loader2, Plus, Info } from "lucide-react";

interface Snapshot {
  name: string;
  description?: string;
  snaptime?: number;
  vmstate?: number;
}

interface SnapshotManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  hypervisorId: string;
  vmId: string;
  vmName: string;
}

export default function SnapshotManagerModal({
  isOpen,
  onClose,
  hypervisorId,
  vmId,
  vmName
}: SnapshotManagerModalProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newVmState, setNewVmState] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsCreating(false);
      setNewName("");
      setNewDesc("");
      fetchSnapshots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchSnapshots = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/hypervisors/${hypervisorId}/vms/${vmId}/snapshots`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao listar snapshots");
      setSnapshots(data.snapshots || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      setError("O nome do snapshot é obrigatório.");
      return;
    }
    setActionLoading("create");
    setError("");
    try {
      const res = await fetch(`/api/admin/hypervisors/${hypervisorId}/vms/${vmId}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc, vmstate: newVmState })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar snapshot");
      setIsCreating(false);
      fetchSnapshots();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRollback = async (snapName: string) => {
    if (!confirm(`TEM CERTEZA? A VM será restaurada para o estado do snapshot '${snapName}'. Dados atuais serão perdidos.`)) return;
    setActionLoading(`rollback-${snapName}`);
    setError("");
    try {
      const res = await fetch(`/api/admin/hypervisors/${hypervisorId}/vms/${vmId}/snapshots/${snapName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rollback" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao restaurar snapshot");
      // Optional: close modal or reload list
      fetchSnapshots();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (snapName: string) => {
    if (!confirm(`Tem certeza que deseja excluir o snapshot '${snapName}'? Esta ação não pode ser desfeita.`)) return;
    setActionLoading(`delete-${snapName}`);
    setError("");
    try {
      const res = await fetch(`/api/admin/hypervisors/${hypervisorId}/vms/${vmId}/snapshots/${snapName}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao excluir snapshot");
      fetchSnapshots();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      <div className="relative bg-bg-secondary border border-border-color rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-color">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary tracking-tight">Snapshots</h2>
              <p className="text-xs text-text-muted mt-1">Gerenciando snapshots de: <span className="font-semibold text-text-secondary">{vmName}</span> (ID: {vmId})</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-bg-tertiary rounded-xl text-text-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {isCreating ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Nome do Snapshot</label>
                <input 
                  type="text" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.replace(/[^a-zA-Z0-9\-_]/g, ''))}
                  placeholder="ex: antes_da_att_v2"
                  className="w-full bg-input-bg border border-input-border text-text-primary text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  autoFocus
                />
                <p className="text-[10px] text-text-muted">Use apenas letras, números, hífens ou underlines.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Descrição (Opcional)</label>
                <input 
                  type="text" 
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Motivo da criação..."
                  className="w-full bg-input-bg border border-input-border text-text-primary text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-bg-tertiary border border-border-color rounded-xl">
                <input 
                  type="checkbox" 
                  id="vmstate" 
                  checked={newVmState}
                  onChange={(e) => setNewVmState(e.target.checked)}
                  className="w-4 h-4 rounded bg-input-bg border-input-border text-blue-500 focus:ring-blue-500/50 cursor-pointer"
                />
                <label htmlFor="vmstate" className="flex-1 cursor-pointer">
                  <div className="text-sm font-semibold text-text-primary">Salvar estado da Memória RAM</div>
                  <div className="text-xs text-text-muted">A VM não será desligada ao restaurar. Demora mais tempo.</div>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border-color">
                <button 
                  onClick={() => setIsCreating(false)}
                  className="flex-1 px-4 py-2.5 bg-bg-tertiary hover:bg-bg-tertiary/80 text-text-primary text-sm font-semibold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCreate}
                  disabled={actionLoading === "create" || !newName}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
                >
                  {actionLoading === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  Tirar Snapshot
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-text-secondary">Snapshots Salvos</h3>
                <button 
                  onClick={() => setIsCreating(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 rounded-lg text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo
                </button>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                  <p className="text-xs text-text-muted font-medium">Buscando snapshots no Proxmox...</p>
                </div>
              ) : snapshots.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-border-color rounded-2xl bg-bg-tertiary/50">
                  <Camera className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-text-secondary font-medium">Nenhum snapshot encontrado.</p>
                  <p className="text-xs text-text-muted mt-1">Clique em "Novo" para salvar o estado atual.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {snapshots.map((snap) => (
                    <div key={snap.name} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-bg-primary border border-border-color rounded-xl hover:border-border-color/80 transition-colors gap-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-primary">{snap.name}</span>
                          {snap.vmstate === 1 && (
                            <span className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] rounded font-bold">RAM</span>
                          )}
                        </div>
                        {snap.description && (
                          <span className="text-xs text-text-secondary mt-1">{snap.description}</span>
                        )}
                        {snap.snaptime && (
                          <span className="text-[10px] text-text-muted mt-1.5">
                            {new Date(snap.snaptime * 1000).toLocaleString("pt-BR")}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          title="Restaurar (Rollback)"
                          onClick={() => handleRollback(snap.name)}
                          disabled={!!actionLoading}
                          className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 border border-blue-500/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {actionLoading === `rollback-${snap.name}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        </button>
                        <button
                          title="Excluir Snapshot"
                          onClick={() => handleDelete(snap.name)}
                          disabled={!!actionLoading}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {actionLoading === `delete-${snap.name}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
