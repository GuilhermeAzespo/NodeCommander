"use client";
import React, { useState, useEffect } from "react";
import { 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Lock,
  Globe,
  Settings
} from "lucide-react";

export default function SMTPPage() {
  const [host, setHost] = useState("");
  const [port, setPort] = useState(587);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [from, setFrom] = useState("noreply@nodecommander.com");
  const [secure, setSecure] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [testEmail, setTestEmail] = useState("");
  const [showTestPrompt, setShowTestPrompt] = useState(false);

  useEffect(() => {
    fetchSMTPConfig();
  }, []);

  const fetchSMTPConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/smtp");
      const data = await res.json();
      if (res.ok && data.config) {
        setHost(data.config.host || "");
        setPort(data.config.port || 587);
        setUser(data.config.user || "");
        setPassword(data.config.password || "");
        setFrom(data.config.from || "noreply@nodecommander.com");
        setSecure(!!data.config.secure);
      }
    } catch (err) {
      setError("Falha ao carregar configurações de e-mail.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaveLoading(true);

    try {
      const res = await fetch("/api/admin/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port, user, password, from, secure })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Configurações SMTP salvas com sucesso!");
        setPassword("[OCULTADO]"); // Re-mask
        setTimeout(() => setSuccess(""), 4000);
      } else {
        setError(data.error || "Erro ao salvar configurações.");
      }
    } catch (err) {
      setError("Erro de comunicação com o servidor.");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) return;

    setError("");
    setSuccess("");
    setTestLoading(true);

    try {
      const res = await fetch("/api/admin/smtp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host, port, user, password, from, secure, testEmail })
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(`E-mail de teste enviado com sucesso para: ${testEmail}`);
        setShowTestPrompt(false);
        setTestEmail("");
        setTimeout(() => setSuccess(""), 6000);
      } else {
        setError(data.error || "Ocorreu um erro no servidor ao disparar o e-mail.");
      }
    } catch (err) {
      setError("Erro de rede ao tentar enviar e-mail de teste.");
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">Configurações SMTP</h1>
        <p className="text-text-secondary mt-1">Configure o serviço de e-mail para envio de alertas do sistema e notificações críticas.</p>
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

      {loading ? (
        <div className="py-20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Config Form */}
          <div className="bg-bg-secondary border border-border-color p-6 rounded-2xl lg:col-span-2 shadow-xl">
            <form onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Servidor Host SMTP</label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                    <input
                      type="text"
                      required
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="smtp.mailtrap.io"
                      className="w-full pl-10 pr-4 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Porta</label>
                  <input
                    type="number"
                    required
                    value={port}
                    onChange={(e) => setPort(parseInt(e.target.value))}
                    placeholder="587"
                    className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Usuário / E-mail Autenticação</label>
                  <input
                    type="text"
                    required
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">E-mail de Remetente (FROM)</label>
                <input
                  type="email"
                  required
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="noreply@nodecommander.com"
                  className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="secure"
                  checked={secure}
                  onChange={(e) => setSecure(e.target.checked)}
                  className="w-4 h-4 bg-input-bg border-input-border rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="secure" className="text-sm text-text-secondary cursor-pointer select-none">
                  Requer conexão segura SSL/TLS (Usar na porta 465)
                </label>
              </div>

              <div className="border-t border-border-color pt-5 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowTestPrompt(true)}
                  className="px-4 py-2.5 bg-bg-primary hover:bg-bg-tertiary border border-border-color hover:border-border-color/80 text-text-secondary hover:text-text-primary rounded-xl text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4 text-text-muted" />
                  <span>Testar Disparo</span>
                </button>

                <button
                  type="submit"
                  disabled={saveLoading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:bg-blue-800"
                >
                  {saveLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Configurações</span>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Tips Info Panel */}
          <div className="bg-bg-secondary border border-border-color p-6 rounded-2xl space-y-4 shadow-xl">
            <h3 className="font-bold text-text-primary text-lg flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-500" />
              Notificações e Alertas
            </h3>
            <p className="text-text-secondary text-xs leading-relaxed">
              O NodeCommander utiliza e-mails para manter a administração informada sobre ações que podem impactar a infraestrutura de rede e servidores.
            </p>
            <div className="space-y-3 pt-2 text-xs text-text-primary">
              <div className="p-3 bg-bg-primary border border-border-color rounded-xl">
                <span className="font-bold text-text-primary block mb-1">Ações Críticas</span>
                Disparos automáticos ocorrem no desligamento (STOP) ou reinicialização (REBOOT) de qualquer máquina virtual.
              </div>
              <div className="p-3 bg-bg-primary border border-border-color rounded-xl">
                <span className="font-bold text-text-primary block mb-1">Alterações no Nó</span>
                Adições, remoções ou falhas persistentes de conexão nos hipervisores notificam imediatamente a lista de administradores.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Mail Prompt Modal */}
      {showTestPrompt && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-bg-secondary border border-border-color rounded-2xl w-full max-w-md shadow-2xl relative animate-scale-up">
            <div className="p-6 border-b border-border-color">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-500" />
                Testar Servidor de E-mail
              </h2>
              <p className="text-text-secondary text-xs mt-1">
                Forneça um endereço de e-mail de destino para validar os parâmetros de conexão.
              </p>
            </div>

            <form onSubmit={handleTestEmail}>
              <div className="p-6">
                <label className="block text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">E-mail Destinatário</label>
                <input
                  type="email"
                  required
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="admin@dominio.com"
                  className="w-full px-3.5 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                />
              </div>

              <div className="p-6 border-t border-border-color flex justify-end gap-3 bg-bg-secondary/50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowTestPrompt(false)}
                  className="px-4 py-2 border border-border-color hover:bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={testLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:bg-blue-800"
                >
                  {testLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <span>Enviar E-mail</span>
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
