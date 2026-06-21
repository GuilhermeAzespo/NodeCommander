"use client";

import React, { useEffect, useState } from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { Loader2, Activity, TrendingUp } from "lucide-react";

interface Metric {
  id: string;
  timestamp: string;
  cpuUsage: number;
  memUsage: number;
  totalVMs: number;
  runningVMs: number;
}

export default function DashboardCharts() {
  const [data, setData] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeframe, setTimeframe] = useState("24h"); // 24h or 7d

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/metrics/historical?timeframe=${timeframe}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch metrics");
      setData(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem);
    if (timeframe === "24h") {
      return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit" });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const date = new Date(label);
      return (
        <div className="bg-bg-secondary border border-border-color p-3 rounded-xl shadow-xl text-xs space-y-1">
          <p className="font-bold text-text-primary border-b border-border-color pb-1 mb-2">
            {date.toLocaleString("pt-BR")}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
              <span className="text-text-secondary">{entry.name}:</span>
              <span className="font-bold" style={{ color: entry.color }}>
                {entry.value}%
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-bg-secondary border border-border-color rounded-2xl flex flex-col overflow-hidden">
      <div className="p-6 border-b border-border-color flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-text-primary text-lg">Consumo do Cluster</h2>
            <p className="text-text-muted text-xs mt-0.5">Média de uso de CPU e RAM de todos os nós</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-input-bg p-1 border border-input-border rounded-xl text-xs font-semibold text-text-secondary">
          <button 
            onClick={() => setTimeframe("24h")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${timeframe === "24h" ? "bg-bg-tertiary text-text-primary shadow-sm" : "hover:text-text-primary"}`}
          >
            Últimas 24h
          </button>
          <button 
            onClick={() => setTimeframe("7d")}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${timeframe === "7d" ? "bg-bg-tertiary text-text-primary shadow-sm" : "hover:text-text-primary"}`}
          >
            Últimos 7 dias
          </button>
        </div>
      </div>

      <div className="p-6 h-[350px] w-full relative">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg-secondary/50 backdrop-blur-sm z-10">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-xs text-text-secondary font-medium">Carregando métricas históricas...</p>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-red-400 text-xs bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20">{error}</p>
          </div>
        ) : data.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Activity className="w-8 h-8 text-text-muted opacity-50" />
            <p className="text-text-muted text-xs">Aguardando primeira coleta de dados pelo robô interno...</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRam" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatXAxis} 
                tick={{ fontSize: 10, fill: '#64748b' }} 
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#64748b' }} 
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                name="Uso de CPU"
                dataKey="cpuUsage" 
                stroke="#3b82f6" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorCpu)" 
              />
              <Area 
                type="monotone" 
                name="Uso de RAM"
                dataKey="memUsage" 
                stroke="#10b981" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorRam)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
