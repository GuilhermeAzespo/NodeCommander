"use client";

import React, { useEffect, useRef, useState } from "react";
// @ts-ignore
import RFB from "@novnc/novnc";

export interface NoVncConsoleProps {
  ticket: string;
  port: number;
  apiPort?: number;
  host: string;
  node: string;
  vmid?: string;
  proxyAuthToken: string;
  type?: "vnc" | "shell";
}

export default function NoVncConsole({ ticket, port, apiPort, host, node, vmid, proxyAuthToken, type }: NoVncConsoleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string>("Conectando...");
  const rfbRef = useRef<RFB | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Constrói a URL do WebSocket para o proxy interno
    const currentHost = window.location.host;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    
    // A URL original do proxmox
    const targetWsPath = type === "shell" 
      ? `/api2/json/nodes/${node}/vncwebsocket` 
      : `/api2/json/nodes/${node}/qemu/${vmid}/vncwebsocket`;
      
    const targetWsUrl = `wss://${host}:${apiPort || 8006}${targetWsPath}?port=${port}&vncticket=${encodeURIComponent(ticket)}`;
    
    // Our proxy URL
    const wsUrl = `${protocol}//${currentHost}/api/vncproxy?target=${encodeURIComponent(targetWsUrl)}&ticket=${encodeURIComponent(ticket)}&proxyAuthToken=${encodeURIComponent(proxyAuthToken)}`;

    try {
      const rfb = new RFB(containerRef.current, wsUrl, {
        credentials: { password: ticket },
      });
      
      rfb.scaleViewport = true;
      rfb.resizeSession = false;
      rfbRef.current = rfb;

      rfb.addEventListener("connect", () => {
        setStatus("Conectado");
      });
      rfb.addEventListener("disconnect", (e: any) => {
        setStatus(`Desconectado: ${(e as any).detail?.reason || "Conexão encerrada"}`);
      });
      rfb.addEventListener("credentialsrequired", () => {
        setStatus("Credenciais requeridas (Erro)");
      });
      rfb.addEventListener("securityfailure", () => {
        setStatus("Falha de segurança na conexão");
      });

      return () => {
        try {
          rfb.disconnect();
        } catch (e) {}
      };
    } catch (err: any) {
      console.error("NoVNC Init Error:", err);
      setStatus(`Erro interno: ${err.message}`);
    }
  }, [ticket, port, host, node, vmid, type]);

  return (
    <div className="flex flex-col h-full bg-black w-full">
      <div className="bg-bg-tertiary/80 text-text-secondary px-4 py-2 text-xs font-semibold flex justify-between items-center border-b border-border-color">
        <span className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === "Conectado" ? "bg-emerald-500" : status.startsWith("Desconectado") || status.startsWith("Erro") ? "bg-red-500" : "bg-amber-500 animate-pulse"}`}></div>
          {status}
        </span>
        <div className="flex gap-2">
           <button onClick={() => rfbRef.current?.sendCtrlAltDel()} className="px-2 py-1 bg-bg-primary hover:bg-bg-secondary rounded text-[10px] transition-colors border border-border-color hover:border-text-muted">
             Ctrl+Alt+Del
           </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 w-full relative overflow-hidden bg-black flex items-center justify-center">
        {/* RFB canvas will be injected here */}
      </div>
    </div>
  );
}
