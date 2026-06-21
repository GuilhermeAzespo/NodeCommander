"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  TerminalSquare, Plus, Trash2, Edit2, Loader2,
  CheckCircle2, AlertCircle, X, Wifi, WifiOff, Save, Eye, EyeOff, RefreshCw
} from "lucide-react";
import SshTerminal from "@/components/SshTerminal";

interface SshSession {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  createdAt: string;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export default function SshConsolePage() {
  const [sessions, setSessions] = useState<SshSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Multisession state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionStatuses, setSessionStatuses] = useState<Record<string, ConnectionStatus>>({});
  const wsRefs = useRef<Record<string, WebSocket>>({});

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingSession, setEditingSession] = useState<SshSession | null>(null);
  const [formName, setFormName] = useState("");
  const [formHost, setFormHost] = useState("");
  const [formPort, setFormPort] = useState("22");
  const [formUser, setFormUser] = useState("");
  const [formPass, setFormPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const loaded = await fetchSessions();
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const autoIp = params.get("auto_ip");
        const autoName = params.get("auto_name");
        
        if (autoIp) {
          const existing = loaded.find((s: SshSession) => s.host === autoIp);
          if (existing) {
            connect(existing);
          } else {
            resetForm();
            setFormHost(autoIp);
            if (autoName) setFormName(autoName);
            setShowForm(true);
          }
          // Remove query params to prevent re-triggering on reload
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };
    init();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ssh/sessions");
      const data = await res.json();
      if (res.ok) {
        setSessions(data.sessions || []);
        return data.sessions || [];
      }
      return [];
    } catch { 
      setError("Falha ao carregar sessões."); 
      return [];
    } finally { 
      setLoading(false); 
    }
  };

  const resetForm = () => {
    setFormName(""); setFormHost(""); setFormPort("22");
    setFormUser(""); setFormPass(""); setShowPass(false);
    setEditingSession(null); setShowForm(false);
  };

  const openNewForm = () => { resetForm(); setShowForm(true); };

  const openEditForm = (s: SshSession) => {
    setEditingSession(s);
    setFormName(s.name); setFormHost(s.host);
    setFormPort(String(s.port)); setFormUser(s.username);
    setFormPass(""); setShowForm(true);
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formHost || !formUser || (!editingSession && !formPass)) {
      setError("Preencha todos os campos obrigatórios."); return;
    }
    setFormLoading(true); setError("");
    try {
      const method = editingSession ? "PATCH" : "POST";
      const body: any = { name: formName, host: formHost, port: formPort, username: formUser };
      if (editingSession) body.id = editingSession.id;
      if (formPass) body.password = formPass;

      const res = await fetch("/api/ssh/sessions", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess(editingSession ? "Sessão atualizada!" : "Sessão criada!");
      resetForm(); fetchSessions();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) { setError(err.message); }
    finally { setFormLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deletar esta sessão SSH?")) return;
    try {
      await fetch(`/api/ssh/sessions?id=${id}`, { method: "DELETE" });
      closeTab(id);
      fetchSessions();
    } catch { setError("Falha ao deletar sessão."); }
  };

  const closeTab = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (wsRefs.current[id]) {
      wsRefs.current[id].close();
      delete wsRefs.current[id];
    }
    setSessionStatuses(prev => {
      const newSt = { ...prev };
      delete newSt[id];
      return newSt;
    });
    if (activeSessionId === id) setActiveSessionId(null);
  };

  const connect = async (session: SshSession) => {
    // Se já existe uma conexão rodando (ou conectando), apenas foca nela
    if (wsRefs.current[session.id] && (sessionStatuses[session.id] === "connected" || sessionStatuses[session.id] === "connecting")) {
      setActiveSessionId(session.id);
      return;
    }

    // Se havia uma morta, limpa antes
    if (wsRefs.current[session.id]) {
      wsRefs.current[session.id].close();
    }

    setActiveSessionId(session.id);
    setSessionStatuses(prev => ({ ...prev, [session.id]: "connecting" }));
    setError("");

    try {
      const tokenRes = await fetch("/api/ssh/token", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error);

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/sshproxy?sessionId=${session.id}&authToken=${tokenData.authToken}`;
      const ws = new WebSocket(wsUrl);
      wsRefs.current[session.id] = ws;

      ws.addEventListener("message", (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "status") {
            setSessionStatuses(prev => ({ ...prev, [session.id]: msg.message }));
          } else if (msg.type === "error") {
            setSessionStatuses(prev => ({ ...prev, [session.id]: "error" }));
            setError(`[${session.name}] ${msg.message}`);
          }
        } catch {}
      });

      ws.addEventListener("close", () => {
        setSessionStatuses(prev => ({ ...prev, [session.id]: "disconnected" }));
        delete wsRefs.current[session.id];
      });
      ws.addEventListener("error", () => {
        setSessionStatuses(prev => ({ ...prev, [session.id]: "error" }));
        delete wsRefs.current[session.id];
      });
    } catch (err: any) {
      setSessionStatuses(prev => ({ ...prev, [session.id]: "error" }));
      setError(`[${session.name}] ${err.message}`);
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const activeStatus = activeSessionId ? (sessionStatuses[activeSessionId] || "idle") : "idle";

  const statusColorMap: Record<string, string> = { idle: "text-text-muted", connecting: "text-amber-400", connected: "text-emerald-400", disconnected: "text-text-muted", error: "text-rose-400" };
  const statusLabelMap: Record<string, string> = { idle: "Sem conexão", connecting: "Conectando...", connected: "Conectado", disconnected: "Desconectado", error: "Erro" };
  
  const statusColor = statusColorMap[activeStatus] || "text-text-muted";
  const statusLabel = statusLabelMap[activeStatus] || "Sem conexão";

  // Retorna todas as chaves do sessionStatuses onde o socket está tecnicamente tentado
  const openTabs = Object.keys(sessionStatuses);

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight flex items-center gap-3">
            <TerminalSquare className="w-8 h-8 text-emerald-500" />
            Console Remoto
          </h1>
          <p className="text-text-secondary mt-1">Gerencie e acesse servidores via SSH de forma centralizada.</p>
        </div>
        <button onClick={openNewForm} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-xl font-medium transition-colors cursor-pointer shadow-lg shadow-emerald-900/20 shrink-0">
          <Plus className="w-5 h-5" />
          <span>Nova Sessão</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 min-h-0">
        {/* Sessions list */}
        <div className="flex flex-col gap-3 overflow-y-auto pr-2">
          <h2 className="text-xs font-black text-text-muted uppercase tracking-wider px-1">Sessões Salvas</h2>
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 text-emerald-500 animate-spin" /></div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-center bg-bg-secondary border border-border-color rounded-2xl">
              <TerminalSquare className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary text-sm font-medium">Nenhuma sessão salva</p>
              <p className="text-text-muted text-xs mt-1">Clique em "Nova Sessão" para começar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => {
                const sStatus = sessionStatuses[s.id];
                const isActive = activeSessionId === s.id;
                const isConnectedOrConnecting = sStatus === "connected" || sStatus === "connecting";
                
                return (
                  <div key={s.id} className={`p-4 rounded-xl border transition-all ${isActive ? "border-emerald-500 bg-emerald-500/5 shadow-sm shadow-emerald-500/10" : "border-border-color bg-bg-secondary hover:border-border-color/60"}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-text-primary text-sm truncate flex items-center gap-2">
                          {s.name}
                          {sStatus === "connected" && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                        </p>
                        <p className="text-text-secondary text-[11px] truncate">{s.username}@{s.host}:{s.port}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEditForm(s)} className="p-1.5 rounded-lg hover:bg-bg-primary text-text-muted hover:text-text-primary transition-colors cursor-pointer" title="Editar"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors cursor-pointer" title="Deletar"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => connect(s)}
                        disabled={sStatus === "connecting"}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${isActive && isConnectedOrConnecting ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-600 hover:bg-emerald-500 text-white"}`}
                      >
                        {sStatus === "connecting" ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /><span>Conectando...</span></>
                        ) : isConnectedOrConnecting ? (
                          <><Eye className="w-3 h-3" /><span>Focar Aba</span></>
                        ) : (
                          <><Wifi className="w-3 h-3" /><span>Conectar</span></>
                        )}
                      </button>
                      {isConnectedOrConnecting && (
                        <button 
                          onClick={(e) => closeTab(s.id, e)}
                          className="py-1.5 px-2.5 rounded-lg text-xs transition-all flex items-center justify-center cursor-pointer bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                          title="Desconectar"
                        >
                          <WifiOff className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Terminal Area */}
        <div className="flex flex-col bg-bg-secondary border border-border-color rounded-2xl overflow-hidden min-h-0 h-full">
          {/* Terminal header */}
          <div className="flex items-center justify-between px-4 py-3 bg-bg-primary/60 border-b border-border-color">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              </div>
              <span className="text-text-secondary text-xs font-mono">
                {activeSession ? `${activeSession.username}@${activeSession.host}` : "Nenhuma aba focada"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-bold flex items-center gap-1.5 ${statusColor}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${activeStatus === "connected" ? "bg-emerald-400 animate-pulse" : activeStatus === "connecting" ? "bg-amber-400 animate-pulse" : activeStatus === "error" ? "bg-rose-400" : "bg-text-muted"}`} />
                {statusLabel}
              </span>
              {activeStatus === "connected" && activeSession && (
                <button onClick={() => { closeTab(activeSession.id); connect(activeSession); }} className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-muted hover:text-text-primary transition-colors cursor-pointer" title="Reconectar">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Terminal body - renderiza múltiplos Xterms e usa display none para abas inativas */}
          <div className="flex-1 flex flex-col relative min-h-0 h-full bg-[#0d1117]">
            {openTabs.length === 0 || !activeSessionId ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <TerminalSquare className="w-10 h-10 text-emerald-500" />
                </div>
                <div className="text-center">
                  <p className="text-emerald-400 font-bold">Console Multi-Sessões</p>
                  <p className="text-text-muted text-sm mt-1">Conecte-se em múltiplos servidores ao mesmo tempo.</p>
                </div>
                <p className="text-text-muted text-xs font-mono opacity-50 animate-pulse">{'>'} _</p>
              </div>
            ) : (
              openTabs.map(tabId => (
                <div key={tabId} className={`absolute inset-0 ${activeSessionId === tabId ? "block" : "hidden"}`}>
                  <SshTerminal 
                    ws={wsRefs.current[tabId]} 
                    onDisconnect={() => closeTab(tabId)} 
                    isActive={activeSessionId === tabId} 
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal - New/Edit Session */}
      {showForm && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-border-color rounded-2xl w-full max-w-md shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-border-color flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <TerminalSquare className="w-5 h-5 text-emerald-500" />
                {editingSession ? "Editar Sessão SSH" : "Nova Sessão SSH"}
              </h2>
              <button onClick={resetForm} className="p-2 hover:bg-bg-primary rounded-xl text-text-muted hover:text-text-primary transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveSession} className="p-6 space-y-4">
              <div>
                <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Nome da Sessão *</label>
                <input type="text" required value={formName} onChange={(e) => setFormName(e.target.value)} placeholder='Ex: "Servidor Web Prod"' className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-emerald-500 text-sm transition-colors" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Host / IP *</label>
                  <input type="text" required value={formHost} onChange={(e) => setFormHost(e.target.value)} placeholder="192.168.1.100" className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-emerald-500 text-sm transition-colors" />
                </div>
                <div>
                  <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Porta *</label>
                  <input type="number" required value={formPort} onChange={(e) => setFormPort(e.target.value)} className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary focus:outline-none focus:border-emerald-500 text-sm transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Usuário *</label>
                <input type="text" required value={formUser} onChange={(e) => setFormUser(e.target.value)} placeholder="root" className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-emerald-500 text-sm transition-colors" />
              </div>
              <div>
                <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Senha {editingSession ? "(deixe em branco para manter)" : "*"}</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} required={!editingSession} value={formPass} onChange={(e) => setFormPass(e.target.value)} placeholder={editingSession ? "••••••••" : "Senha de acesso"} className="w-full px-3.5 py-2.5 pr-10 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-emerald-500 text-sm transition-colors" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors cursor-pointer">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={resetForm} className="px-4 py-2.5 border border-border-color text-text-secondary hover:text-text-primary hover:bg-bg-primary rounded-xl text-sm font-semibold transition-colors cursor-pointer">Cancelar</button>
                <button type="submit" disabled={formLoading} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer">
                  {formLoading ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Salvando...</span></> : <><Save className="w-4 h-4" /><span>Salvar Sessão</span></>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
