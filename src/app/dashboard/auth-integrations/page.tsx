"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Key, 
  Server, 
  Globe, 
  Building2, 
  CheckCircle2, 
  Loader2, 
  AlertTriangle,
  Lock,
  EyeOff,
  Eye,
  Save,
  Wifi
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

export default function AuthIntegrationsPage() {
  const [activeTab, setActiveTab] = useState<"AD" | "GOOGLE" | "M365">("AD");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Forms State
  const [adConfig, setAdConfig] = useState({ enabled: false, url: "", baseDN: "", bindDN: "", password: "" });
  const [googleConfig, setGoogleConfig] = useState({ enabled: false, clientId: "", clientSecret: "", domain: "" });
  const [m365Config, setM365Config] = useState({ enabled: false, tenantId: "", clientId: "", clientSecret: "" });

  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean}>({ isOpen: false });

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth-settings");
      if (res.ok) {
        const data = await res.json();
        if (data.ad) setAdConfig(data.ad);
        if (data.google) setGoogleConfig(data.google);
        if (data.m365) setM365Config(data.m365);
      } else {
        setError("Erro ao carregar configurações de integração.");
      }
    } catch (err) {
      setError("Falha de rede ao conectar à API.");
    } finally {
      setLoading(false);
    }
  };

  const openSaveConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmDialog({ isOpen: true });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError("");
    setSuccess("");

    let payload;
    if (activeTab === "AD") payload = { type: "AD", config: adConfig };
    else if (activeTab === "GOOGLE") payload = { type: "GOOGLE", config: googleConfig };
    else if (activeTab === "M365") payload = { type: "M365", config: m365Config };

    try {
      const res = await fetch("/api/admin/auth-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao testar conexão.");
      
      setSuccess(data.message || "Conexão testada com sucesso!");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setConfirmDialog({ isOpen: false });
    setSaving(true);
    setError("");
    setSuccess("");

    let payload;
    if (activeTab === "AD") payload = { type: "AD", config: adConfig };
    else if (activeTab === "GOOGLE") payload = { type: "GOOGLE", config: googleConfig };
    else if (activeTab === "M365") payload = { type: "M365", config: m365Config };

    try {
      const res = await fetch("/api/admin/auth-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar.");
      
      setSuccess("Configurações salvas com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
      fetchConfigs(); // reload to get masked passwords if needed
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderTabs = () => (
    <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-border-color pb-4">
      <button
        onClick={() => { setActiveTab("AD"); setError(""); setSuccess(""); }}
        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
          activeTab === "AD" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border-color"
        }`}
      >
        <Server className="w-4 h-4" /> Active Directory / LDAP
      </button>
      <button
        onClick={() => { setActiveTab("GOOGLE"); setError(""); setSuccess(""); }}
        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
          activeTab === "GOOGLE" ? "bg-amber-600 text-white shadow-lg shadow-amber-500/20" : "bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border-color"
        }`}
      >
        <Globe className="w-4 h-4" /> Google Workspace
      </button>
      <button
        onClick={() => { setActiveTab("M365"); setError(""); setSuccess(""); }}
        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
          activeTab === "M365" ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/20" : "bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border border-border-color"
        }`}
      >
        <Building2 className="w-4 h-4" /> Microsoft 365
      </button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-10">
      <div>
        <h1 className="text-2xl font-black text-text-primary flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-blue-500" />
          Integrações de Autenticação (SSO)
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Configure métodos de login corporativo para a plataforma NodeCommander.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {renderTabs()}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-text-muted text-sm font-medium">Carregando configurações...</span>
        </div>
      ) : (
        <div className="bg-bg-secondary border border-border-color rounded-2xl overflow-hidden shadow-xl">
          <div className="p-6">
            <form onSubmit={openSaveConfirm} className="space-y-6">
              
              {/* ENABLE/DISABLE TOGGLE (COMMON FOR ALL) */}
              <div className="flex items-center justify-between p-4 bg-bg-primary rounded-xl border border-border-color">
                <div>
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <Key className="w-4 h-4 text-emerald-500" /> Ativar Integração
                  </h3>
                  <p className="text-xs text-text-secondary mt-1">Permitir que usuários façam login no painel usando este provedor.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={
                      activeTab === "AD" ? adConfig.enabled : 
                      activeTab === "GOOGLE" ? googleConfig.enabled : m365Config.enabled
                    }
                    onChange={(e) => {
                      const v = e.target.checked;
                      if (activeTab === "AD") setAdConfig({ ...adConfig, enabled: v });
                      else if (activeTab === "GOOGLE") setGoogleConfig({ ...googleConfig, enabled: v });
                      else if (activeTab === "M365") setM365Config({ ...m365Config, enabled: v });
                    }}
                  />
                  <div className="w-11 h-6 bg-bg-tertiary rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              {/* AD FORM */}
              {activeTab === "AD" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Servidor LDAP (URL)</label>
                    <input type="text" value={adConfig.url} onChange={e => setAdConfig({...adConfig, url: e.target.value})} placeholder="ldaps://ad.empresa.com.br:636" className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 transition-colors text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Base DN</label>
                    <input type="text" value={adConfig.baseDN} onChange={e => setAdConfig({...adConfig, baseDN: e.target.value})} placeholder="DC=empresa,DC=com,DC=br" className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 transition-colors text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Bind DN (Usuário Leitura)</label>
                    <input type="text" value={adConfig.bindDN} onChange={e => setAdConfig({...adConfig, bindDN: e.target.value})} placeholder="CN=BindUser,OU=ServiceAccounts,DC=empresa..." className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 transition-colors text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Senha do Bind DN</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-text-muted" />
                      </div>
                      <input
                        type={showPass ? "text" : "password"}
                        value={adConfig.password}
                        onChange={e => setAdConfig({...adConfig, password: e.target.value})}
                        placeholder={adConfig.password === "********" ? "********" : "Senha segura..."}
                        className="w-full pl-10 pr-10 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-blue-500 text-sm transition-colors"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-text-muted hover:text-text-primary"
                        onClick={() => setShowPass(!showPass)}
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* GOOGLE FORM */}
              {activeTab === "GOOGLE" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Restrição de Domínio</label>
                    <input type="text" value={googleConfig.domain} onChange={e => setGoogleConfig({...googleConfig, domain: e.target.value})} placeholder="ex: empresa.com.br (deixe em branco para permitir qualquer conta)" className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-amber-500 transition-colors text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Client ID</label>
                    <input type="text" value={googleConfig.clientId} onChange={e => setGoogleConfig({...googleConfig, clientId: e.target.value})} placeholder="xxxxxxxxxx.apps.googleusercontent.com" className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-amber-500 transition-colors text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Client Secret</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-text-muted" />
                      </div>
                      <input
                        type={showPass ? "text" : "password"}
                        value={googleConfig.clientSecret}
                        onChange={e => setGoogleConfig({...googleConfig, clientSecret: e.target.value})}
                        placeholder={googleConfig.clientSecret === "********" ? "********" : "GOCSPX-xxxxxxxxxxxxx"}
                        className="w-full pl-10 pr-10 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-amber-500 text-sm transition-colors"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-text-muted hover:text-text-primary"
                        onClick={() => setShowPass(!showPass)}
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* M365 FORM */}
              {activeTab === "M365" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Tenant ID (Directory ID)</label>
                    <input type="text" value={m365Config.tenantId} onChange={e => setM365Config({...m365Config, tenantId: e.target.value})} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-cyan-500 transition-colors text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Application (Client) ID</label>
                    <input type="text" value={m365Config.clientId} onChange={e => setM365Config({...m365Config, clientId: e.target.value})} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="w-full px-4 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-cyan-500 transition-colors text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Client Secret Value</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-text-muted" />
                      </div>
                      <input
                        type={showPass ? "text" : "password"}
                        value={m365Config.clientSecret}
                        onChange={e => setM365Config({...m365Config, clientSecret: e.target.value})}
                        placeholder={m365Config.clientSecret === "********" ? "********" : "Valor do Secret criado no Azure AD"}
                        className="w-full pl-10 pr-10 py-2.5 bg-input-bg border border-input-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-cyan-500 text-sm transition-colors"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-text-muted hover:text-text-primary"
                        onClick={() => setShowPass(!showPass)}
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end pt-6 border-t border-border-color gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || saving}
                  className="bg-bg-tertiary hover:bg-bg-primary text-text-primary border border-border-color px-6 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                  Testar Conexão
                </button>
                <button
                  type="submit"
                  disabled={saving || testing}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Configurações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title="Salvar Configurações"
        message={`Deseja salvar as credenciais e configurações para a integração via ${activeTab === 'AD' ? 'Active Directory' : activeTab === 'GOOGLE' ? 'Google Workspace' : 'Microsoft 365'}?`}
        confirmText="Sim, Salvar"
        cancelText="Cancelar"
        variant="info"
        onConfirm={handleSave}
        onCancel={() => setConfirmDialog({ isOpen: false })}
      />
    </div>
  );
}
