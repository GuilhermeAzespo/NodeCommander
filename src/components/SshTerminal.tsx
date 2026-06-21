"use client";
import React, { useEffect, useRef } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";

interface SshTerminalProps {
  ws: WebSocket | null;
  onDisconnect: () => void;
}

export default function SshTerminal({ ws, onDisconnect }: SshTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current || !ws) return;

    const term = new Terminal({
      theme: { background: "#0d1117" },
      cursorBlink: true,
      fontFamily: "monospace",
      fontSize: 14,
    });
    
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    // Pequeno delay para garantir que o container já tem dimensões
    setTimeout(() => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
      }
    }, 100);

    const handleResize = () => {
      try {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
        }
      } catch (e) {
        // Ignora erros de resize se container invisível
      }
    };
    window.addEventListener("resize", handleResize);

    const onDataDisposable = term.onData((data) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const utf8Bytes = new TextEncoder().encode(data);
      let binString = "";
      for (let i = 0; i < utf8Bytes.length; i++) binString += String.fromCharCode(utf8Bytes[i]);
      ws.send(JSON.stringify({ type: "data", data: btoa(binString) }));
    });

    const msgHandler = (evt: MessageEvent) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "data") {
          const binString = atob(msg.data);
          const bytes = new Uint8Array(binString.length);
          for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i);
          term.write(bytes);
        } else if (msg.type === "status" && msg.message === "disconnected") {
          term.write("\r\nConexão encerrada.\r\n");
          onDisconnect();
        } else if (msg.type === "error") {
          term.write(`\r\nErro: ${msg.message}\r\n`);
        }
      } catch {
        term.write(evt.data);
      }
    };
    
    ws.addEventListener("message", msgHandler);
    ws.addEventListener("close", onDisconnect);

    return () => {
      window.removeEventListener("resize", handleResize);
      onDataDisposable.dispose();
      ws.removeEventListener("message", msgHandler);
      ws.removeEventListener("close", onDisconnect);
      term.dispose();
    };
  }, [ws, onDisconnect]);

  return (
    <div className="w-full h-full p-2 bg-[#0d1117] rounded-b-2xl overflow-hidden">
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  );
}
