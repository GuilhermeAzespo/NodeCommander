"use client";

import React, { useEffect, useRef, useState } from "react";
// @ts-ignore
import RFB from "@novnc/novnc";

export interface NoVncConsoleProps {
  ticket: string;
  port: number;
  host: string;
  node: string;
  vmid?: string;
  type: "vm" | "shell";
}

export default function NoVncConsole({ ticket, port, host, node, vmid, type }: NoVncConsoleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string>("Conectando...");
  const rfbRef = useRef<RFB | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Constrói a URL do WebSocket para o proxy interno
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    
    // A URL original do proxmox
    const targetWsPath = type === "vm" 
      ? `/api2/json/nodes/${node}/qemu/${vmid}/vncwebsocket` 
      : `/api2/json/nodes/${node}/vncwebsocket`;
      
    const targetUrl = `wss://${host}:8006${targetWsPath}?port=${port}&vncticket=${encodeURIComponent(ticket)}`;

    // Passa a URL alvo via query string para o proxy local
    const wsUrl = `${protocol}://${window.location.host}/api/vncproxy?ticket=${encodeURIComponent(ticket)}&target=${encodeURIComponent(targetUrl)}`;

    try {
      const rfb = new RFB(containerRef.current, wsUrl, {
        credentials: { password: "" },
      });
      
      rfbRef.current = rfb;

      rfb.addEventListener("connect", () => {
        setStatus("Conectado");
      });
      rfb.addEventListener("disconnect", (e) => {
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
    <div className="flex flex-col h-full bg-black rounded-lg overflow-hidden border border-slate-800">
      <div className="bg-slate-900 text-slate-300 px-4 py-2 text-xs font-semibold flex justify-between items-center border-b border-slate-800">
        <span className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === "Conectado" ? "bg-emerald-500" : status.startsWith("Desconectado") || status.startsWith("Erro") ? "bg-red-500" : "bg-amber-500 animate-pulse"}`}></div>
          {status}
        </span>
        <div className="flex gap-2">
           <button onClick={() => rfbRef.current?.sendCtrlAltDel()} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] transition-colors border border-slate-700 hover:border-slate-500">
             Ctrl+Alt+Del
           </button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 w-full relative overflow-hidden bg-black flex items-center justify-center min-h-[500px]">
        {/* RFB canvas will be injected here */}
      </div>
    </div>
  );
}
