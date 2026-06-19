export interface VM {
  id: string;
  name: string;
  status: "RUNNING" | "STOPPED" | "PAUSED" | "UNKNOWN";
  cpu: number;      // vCPUs
  memory: number;   // MB (RAM)
  disk: number;     // GB (Disco)
  ipAddress?: string;
  node?: string;
  cpuUsage?: number;   // % (0-100)
  memoryUsed?: number; // MB
  uptime?: number;     // segundos
  netIn?: number;      // bytes/s
  netOut?: number;     // bytes/s
  diskUsed?: number;   // GB
  cpuShares?: number;  // cpu shares / prioridade
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
    node?: string;
  }): Promise<string | boolean>;
  updateVM?(vmId: string, params: {
    name?: string;
    cpu?: number;
    memory?: number;
  }): Promise<boolean>;
  
  listNodes?(): Promise<{
    name: string;
    status: "ONLINE" | "OFFLINE";
    cpuUsage: number;
    memoryUsage: number;
    memoryTotal: number;
    memoryUsed: number;
    uptime: number;
    storages?: {
      name: string;
      type: string;
      total: number;
      used: number;
      avail: number;
      percent: number;
    }[];
  }[]>;

  // Optional VNC and details methods
  listISOs?(): Promise<{ volid: string; name: string }[]>;
  listStorages?(): Promise<{ 
    name: string; 
    type: string; 
    active: boolean; 
    shared: boolean; 
    size?: number; 
    used?: number; 
    avail?: number; 
  }[]>;
  createVncProxy?(vmId: string): Promise<{ ticket: string; port: number; host: string; node: string } | null>;
  createTermProxy?(nodeName?: string): Promise<{ ticket: string; port: number; host: string; node: string } | null>;
  getAuthHeaders?(): Promise<Record<string, string>>;
}
