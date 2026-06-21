"use client";
import React, { useState, useEffect } from "react";
import { Shield, Smartphone, AlertCircle, Loader2, CheckCircle2, Copy } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SecuritySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState(0); // 0: Idle, 1: Setup
  const [actionLoading, setActionLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setMfaEnabled(!!data.user.mfaEnabled);
        }
        setLoading(false);
      });
  }, []);

  const handleSetupMfa = async () => {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQrCodeUrl(data.qrCode);
      setSecret(data.secret);
      setStep(1);
    } catch (err: any) {
      setError(err.message || "Erro ao configurar MFA.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMfaEnabled(true);
      setStep(0);
      setCode("");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Código inválido.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!confirm("Tem certeza que deseja desativar a autenticação em duas etapas?")) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/disable", { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao desativar.");
      setMfaEnabled(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-xl">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Minha Segurança</h1>
          <p className="text-text-secondary text-sm">Gerencie suas configurações de conta e autenticação</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-bg-secondary border border-border-color rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl border ${mfaEnabled ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-text-muted/10 border-text-muted/20 text-text-muted'}`}>
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                Autenticação em Duas Etapas (2FA)
                {mfaEnabled && <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-xs rounded-full border border-green-500/20">Ativo</span>}
              </h2>
              <p className="text-text-secondary text-sm mt-1 max-w-xl">
                Adicione uma camada extra de segurança à sua conta. Sempre que você fizer login, será necessário informar uma senha e um código gerado pelo seu celular.
              </p>
            </div>
          </div>

          <div>
            {!mfaEnabled && step === 0 && (
              <button
                onClick={handleSetupMfa}
                disabled={actionLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Configurar 2FA
              </button>
            )}

            {mfaEnabled && (
              <button
                onClick={handleDisableMfa}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-sm font-medium transition flex items-center gap-2 disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Desativar 2FA
              </button>
            )}
          </div>
        </div>

        {step === 1 && !mfaEnabled && (
          <div className="mt-8 p-6 bg-bg-primary rounded-xl border border-border-color flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1 space-y-4">
              <h3 className="font-semibold text-text-primary text-lg">Concluir configuração</h3>
              <p className="text-text-secondary text-sm">
                1. Instale o <strong>Google Authenticator</strong> ou <strong>Authy</strong> no seu celular.<br/>
                2. Escaneie o QR Code ao lado.<br/>
                3. Insira o código de 6 dígitos gerado pelo aplicativo abaixo para confirmar.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 bg-input-bg border border-input-border rounded-lg px-4 py-2 text-center text-xl tracking-widest focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleVerifyMfa}
                  disabled={code.length !== 6 || actionLoading}
                  className="px-6 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Validar
                </button>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-center gap-3">
              <div className="bg-white p-2 rounded-xl">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="QR Code" className="w-40 h-40" />
                ) : (
                  <div className="w-40 h-40 bg-gray-200 animate-pulse rounded-lg" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted bg-input-bg px-3 py-1.5 rounded border border-border-color">
                <span className="font-mono">{secret}</span>
                <button onClick={() => navigator.clipboard.writeText(secret)} className="hover:text-text-primary" title="Copiar código">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
