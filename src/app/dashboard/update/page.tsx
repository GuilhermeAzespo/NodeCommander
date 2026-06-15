"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  GitBranch, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Terminal, 
  ArrowUpCircle,
  User,
  Calendar,
  AlertCircle
} from "lucide-react";

interface CommitInfo {
  hash: string;
  message: string;
  author?: string;
  date?: string;
}

interface UpdateData {
  local: CommitInfo;
  remote: CommitInfo | null;
  status: "idle" | "updating" | "success" | "failed";
  log: string;
  error: string | null;
  updateAvailable: boolean;
}

export default function UpdatePage() {
  const [data, setData] = useState<UpdateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchStatus = async (showChecking = false) => {
    if (showChecking) setChecking(true);
    try {
      const res = await fetch("/api/admin/update");
      if (res.ok) {
        const body = await res.json();
        setData(body);
        setPageError(null);
      } else {
        const errData = await res.json();
        setPageError(errData.error || "Erro ao obter status de atualização.");
      }
    } catch (err) {
      setPageError("Erro de rede ao buscar atualizações.");
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  // Poll status when updating
  useEffect(() => {
    fetchStatus();
    
    let interval: NodeJS.Timeout;
    if (data?.status === "updating") {
      interval = setInterval(() => {
        fetchStatus();
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [data?.status]);

  // Scroll log terminal to bottom on update
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [data?.log]);

  const handleTriggerUpdate = async () => {
    if (!confirm("Tem certeza que deseja atualizar o sistema agora? O servidor será reiniciado e ficará offline por alguns segundos.")) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/update", { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        // Refresh status to enter updating state
        fetchStatus();
      } else {
        alert(body.error || "Falha ao iniciar atualização.");
      }
    } catch (err) {
      alert("Erro de rede ao iniciar atualização.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatHash = (hash: string) => hash.substring(0, 7);
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString("pt-BR");
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-text-secondary text-sm">Carregando informações de atualização...</p>
      </div>
    );
  }

  const isUpdating = data?.status === "updating";

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Atualização do Sistema</h1>
          <p className="text-text-secondary mt-1">Gerencie a versão do NodeCommander e busque atualizações diretamente do GitHub.</p>
        </div>
        <button
          onClick={() => fetchStatus(true)}
          disabled={isUpdating || checking || actionLoading}
          className="flex items-center justify-center gap-2 border border-border-color hover:bg-bg-tertiary text-text-primary px-5 py-3 rounded-xl font-medium transition-colors cursor-pointer disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
          <span>{checking ? "Buscando..." : "Buscar Atualizações"}</span>
        </button>
      </div>

      {pageError && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{pageError}</span>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Status Column */}
          <div className="lg:col-span-1 space-y-6">
            {/* Status Panel Card */}
            <div className="p-6 bg-bg-secondary border border-border-color rounded-2xl shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-text-primary">Status da Versão</h2>
              
              {data.status === "updating" ? (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-semibold text-sm">Atualizando o Sistema...</span>
                  </div>
                  <p className="text-xs text-blue-300">
                    Baixando novos commits e recompilando a aplicação. O painel reiniciará ao terminar.
                  </p>
                </div>
              ) : data.status === "success" ? (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-semibold text-sm">Atualização bem-sucedida!</span>
                  </div>
                  <p className="text-xs text-emerald-300">
                    O servidor está reiniciando para aplicar as mudanças. Aguarde alguns instantes e recarregue a página.
                  </p>
                </div>
              ) : data.status === "failed" ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-semibold text-sm">Falha na Atualização</span>
                  </div>
                  <p className="text-xs text-red-300">
                    Ocorreu um erro durante o processo de atualização. Verifique os logs detalhados ao lado.
                  </p>
                </div>
              ) : data.updateAvailable ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <ArrowUpCircle className="w-5 h-5" />
                    <span className="font-semibold text-sm">Atualização Disponível!</span>
                  </div>
                  <p className="text-xs text-amber-300">
                    Nova versão disponível no repositório GitHub. Recomendamos atualizar para obter os recursos mais recentes.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-bg-primary border border-border-color text-text-secondary rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="font-semibold text-sm text-text-primary">Sistema Atualizado</span>
                  </div>
                  <p className="text-xs">
                    Você está rodando a última versão disponível na branch `main` do GitHub.
                  </p>
                </div>
              )}

              {/* Version details list */}
              <div className="space-y-4 pt-2 border-t border-border-color">
                <div className="flex justify-between items-start gap-4">
                  <span className="text-xs font-semibold text-text-secondary uppercase">Commit Local</span>
                  <div className="text-right">
                    <span className="font-mono text-xs bg-bg-tertiary border border-border-color text-text-primary px-2 py-0.5 rounded">
                      {formatHash(data.local.hash)}
                    </span>
                    <p className="text-[10px] text-text-muted mt-1 leading-snug break-all max-w-[150px]">{data.local.message.split("\n")[0]}</p>
                  </div>
                </div>

                {data.remote && (
                  <div className="flex justify-between items-start gap-4 pt-3 border-t border-border-color/50">
                    <span className="text-xs font-semibold text-text-secondary uppercase">Commit Remoto</span>
                    <div className="text-right">
                      <span className="font-mono text-xs bg-bg-tertiary border border-border-color text-text-primary px-2 py-0.5 rounded">
                        {formatHash(data.remote.hash)}
                      </span>
                      <p className="text-[10px] text-text-muted mt-1 leading-snug break-all max-w-[150px]">{data.remote.message.split("\n")[0]}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              {data.updateAvailable && data.status !== "updating" && data.status !== "success" && (
                <button
                  onClick={handleTriggerUpdate}
                  disabled={actionLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/10"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Iniciando...</span>
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="w-4 h-4" />
                      <span>Atualizar Sistema Agora</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Remote Commit Info Details */}
            {data.remote && (
              <div className="p-6 bg-bg-secondary border border-border-color rounded-2xl shadow-sm space-y-4">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Último Commit no GitHub</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2.5 text-text-primary">
                    <GitBranch className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="font-medium line-clamp-2 leading-tight">{data.remote.message}</span>
                  </div>
                  {data.remote.author && (
                    <div className="flex items-center gap-2.5 text-text-secondary text-xs">
                      <User className="w-4 h-4 text-text-muted shrink-0" />
                      <span>Autor: {data.remote.author}</span>
                    </div>
                  )}
                  {data.remote.date && (
                    <div className="flex items-center gap-2.5 text-text-secondary text-xs">
                      <Calendar className="w-4 h-4 text-text-muted shrink-0" />
                      <span>Data: {formatDate(data.remote.date)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Console Log Column */}
          <div className="lg:col-span-2">
            <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              {/* Mock Terminal Header */}
              <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
                  <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                  <Terminal className="w-3 h-3" />
                  <span>update-stdout.log</span>
                </div>
                <div className="w-12"></div>
              </div>

              {/* Console log content */}
              <div className="flex-1 p-5 font-mono text-xs text-slate-300 overflow-y-auto min-h-[350px] max-h-[500px] leading-relaxed selection:bg-blue-500/20">
                {data.log ? (
                  <pre className="whitespace-pre-wrap">{data.log}</pre>
                ) : (
                  <p className="text-slate-500 italic">Nenhum log de atualização gerado até o momento.</p>
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
