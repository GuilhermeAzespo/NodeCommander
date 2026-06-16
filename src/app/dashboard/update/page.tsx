"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Terminal, 
  ArrowUpCircle,
  AlertCircle,
  Tag,
  Globe
} from "lucide-react";

interface UpdateData {
  localVersion: string;
  remoteVersion: string | null;
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
    } else if (data?.status === "success") {
      // Reload the page automatically after 5 seconds
      const reloadTimeout = setTimeout(async () => {
        await fetch("/api/admin/update", { method: "DELETE" });
        window.location.reload();
      }, 5000);
      return () => clearTimeout(reloadTimeout);
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

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-text-secondary text-sm">Carregando informações de versão...</p>
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
                    Baixando nova versão e recompilando a aplicação. O painel reiniciará ao terminar.
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
                  <button
                    onClick={async () => {
                      await fetch("/api/admin/update", { method: "DELETE" });
                      fetchStatus();
                    }}
                    className="mt-2 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-200 px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    Limpar Histórico de Falha
                  </button>
                </div>
              ) : data.updateAvailable ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <ArrowUpCircle className="w-5 h-5" />
                    <span className="font-semibold text-sm">Atualização Disponível!</span>
                  </div>
                  <p className="text-xs text-amber-300">
                    Uma nova versão foi publicada no repositório. Recomendamos atualizar para obter os recursos mais recentes.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-bg-primary border border-border-color text-text-secondary rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="font-semibold text-sm text-text-primary">Sistema Atualizado</span>
                  </div>
                  <p className="text-xs">
                    Você está rodando a última versão estável do NodeCommander.
                  </p>
                </div>
              )}

              {/* Version details list */}
              <div className="space-y-4 pt-4 border-t border-border-color">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Tag className="w-4 h-4 text-text-muted" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Versão Local</span>
                  </div>
                  <span className="text-sm font-bold text-text-primary bg-bg-tertiary px-2.5 py-1 border border-border-color rounded-lg">
                    v{data.localVersion}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border-color/50">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Globe className="w-4 h-4 text-text-muted" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Versão Remota</span>
                  </div>
                  <span className="text-sm font-bold text-text-primary bg-bg-tertiary px-2.5 py-1 border border-border-color rounded-lg">
                    {data.remoteVersion ? `v${data.remoteVersion}` : "---"}
                  </span>
                </div>
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
