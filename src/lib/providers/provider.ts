export interface VM {
  id: string;
  name: string;
  status: "RUNNING" | "STOPPED" | "PAUSED" | "UNKNOWN";
  cpu: number;      // vCPUs
  memory: number;   // MB (RAM)
  disk: number;     // GB (Disco)
  ipAddress?: string;
  node?: string;
}

export interface HostMetrics {
  cpuUsage: number;    // % (0-100)
  memoryUsage: number; // % (0-100)
  diskUsage: number;   // % (0-100)
  uptime: number;      // segundos
}

export interface HypervisorProvider {
  testConnection(): Promise<boolean>;
  getHostMetrics(): Promise<HostMetrics>;
  listVMs(): Promise<VM[]>;
  startVM(vmId: string): Promise<boolean>;
  stopVM(vmId: string): Promise<boolean>;
  rebootVM(vmId: string): Promise<boolean>;
  deleteVM(vmId: string): Promise<boolean>;
  createVM(params: {
    name: string;
    cpu: number;
    memory: number;
    iso?: string | null;
    disks: { storage: string; size: number }[];
  }): Promise<boolean>;
  
  // Optional VNC and details methods
  listISOs?(): Promise<{ volid: string; name: string }[]>;
  listStorages?(): Promise<{ name: string; type: string; active: boolean; shared: boolean }[]>;
  createVncProxy?(vmId: string): Promise<{ ticket: string; port: number; host: string; node: string } | null>;
  createTermProxy?(nodeName?: string): Promise<{ ticket: string; port: number; host: string; node: string } | null>;
  getAuthHeaders?(): Promise<Record<string, string>>;
}
