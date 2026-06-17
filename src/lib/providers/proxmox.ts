import { HypervisorProvider, VM, HostMetrics } from "./provider";
import https from "https";

export class ProxmoxProvider implements HypervisorProvider {
  private host: string;
  private port: number;
  private username: string;
  private credential: string;
  private nodeName: string;
  private isMock: boolean;

  // Cache mock VMs in memory for session-based mock mutations
  private static mockVMs: VM[] = [
    { id: "100", name: "Debian-Webserver", status: "RUNNING", cpu: 2, memory: 2048, disk: 40, ipAddress: "192.168.1.50" },
    { id: "101", name: "Ubuntu-Docker-Host", status: "RUNNING", cpu: 4, memory: 8192, disk: 100, ipAddress: "192.168.1.51" },
    { id: "102", name: "Windows-Server-AD", status: "STOPPED", cpu: 4, memory: 8192, disk: 150 },
    { id: "103", name: "PFSense-Firewall", status: "RUNNING", cpu: 1, memory: 1024, disk: 10, ipAddress: "192.168.1.1" },
    { id: "104", name: "Home-Assistant", status: "PAUSED", cpu: 2, memory: 4096, disk: 50, ipAddress: "192.168.1.99" },
  ];

  constructor(host: string, port: number, username: string, credential: string, nodeName: string = "pve") {
    this.host = host;
    this.port = port;
    this.username = username;
    this.credential = credential;
    this.nodeName = nodeName;
    this.isMock = host === "mock" || host.toLowerCase().includes("mock");
  }

  // Helper to make Proxmox API Requests with self-signed certificate support
  private async request(method: string, path: string, body?: any): Promise<any> {
    if (this.isMock) return null;

    const cleanHost = this.host.replace(/^https?:\/\//, "");
    const url = `https://${cleanHost}:${this.port}/api2/json${path}`;

    const agent = new https.Agent({
      rejectUnauthorized: false, // Proxmox usually has self-signed certs
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    // Check if we use token or ticket authentication
    const isToken = this.credential.includes("PVEAPIToken=") || this.username.includes("!");
    let ticket: string | null = null;
    let csrfToken: string | null = null;

    if (isToken) {
      // Token format: PVEAPIToken=root@pam!tokenid=uuid-secret or credentials contains token format
      if (this.credential.startsWith("PVEAPIToken=")) {
        headers["Authorization"] = this.credential;
      } else {
        headers["Authorization"] = `PVEAPIToken=${this.username}=${this.credential}`;
      }
    } else {
      // Username/Password Ticket Authentication
      const loginRes = await this.loginTicket(agent);
      ticket = loginRes.ticket;
      csrfToken = loginRes.csrfToken;
      headers["Cookie"] = `PVEAuthCookie=${ticket}`;
      if (csrfToken) {
        headers["CSRFPreventionToken"] = csrfToken;
      }
    }

    let requestBody: string | null = null;
    if (body) {
      requestBody = JSON.stringify(body);
    } else if (method === "POST" || method === "PUT") {
      requestBody = "{}";
    }

    if (requestBody !== null) {
      headers["Content-Length"] = String(Buffer.byteLength(requestBody));
    }

    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        method,
        headers,
        agent,
      };

      const req = https.request(url, options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.data);
            } catch (err) {
              resolve(null);
            }
          } else {
            reject(new Error(`Proxmox API request failed with status: ${res.statusCode}. Details: ${data}`));
          }
        });
      });

      req.on("error", (err) => {
        reject(err);
      });

      if (requestBody !== null) {
        req.write(requestBody);
      }
      req.end();
    });
  }

  // Get auth ticket and CSRF token using username & password
  private async loginTicket(agent: https.Agent): Promise<{ ticket: string; csrfToken: string }> {
    const cleanHost = this.host.replace(/^https?:\/\//, "");
    const url = `https://${cleanHost}:${this.port}/api2/json/access/ticket`;

    return new Promise((resolve, reject) => {
      const reqBody = JSON.stringify({
        username: this.username,
        password: this.credential,
      });

      const options: https.RequestOptions = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(reqBody),
        },
        agent,
      };

      const req = https.request(url, options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              resolve({
                ticket: parsed.data.ticket,
                csrfToken: parsed.data.CSRFPreventionToken,
              });
            } catch (err) {
              reject(new Error("Failed to parse login response"));
            }
          } else {
            reject(new Error(`Login failed with status: ${res.statusCode}`));
          }
        });
      });

      req.on("error", (err) => reject(err));
      req.write(reqBody);
      req.end();
    });
  }

  async testConnection(): Promise<boolean> {
    if (this.isMock) {
      return true;
    }
    try {
      // Request version endpoint as a quick check
      const data = await this.request("GET", "/version");
      return !!data && !!data.version;
    } catch (err) {
      console.error("Proxmox testConnection failed:", err);
      return false;
    }
  }

  private async resolveNodeForVM(vmId: string): Promise<string> {
    try {
      const resources = await this.request("GET", "/cluster/resources?type=vm");
      if (resources && Array.isArray(resources)) {
        const vmResource = resources.find((item: any) => String(item.vmid) === String(vmId));
        if (vmResource && vmResource.node) {
          return vmResource.node;
        }
      }
    } catch (err) {
      console.warn(`Failed to resolve node for VM ${vmId} from cluster resources:`, err);
    }
    return this.nodeName; // Fallback
  }

  async getHostMetrics(): Promise<HostMetrics> {
    if (this.isMock) {
      return {
        cpuUsage: 15 + Math.random() * 30, // 15% - 45%
        memoryUsage: 40 + Math.random() * 20, // 40% - 60%
        diskUsage: 28.5,
        uptime: 1548200 + Math.floor(Math.random() * 10),
      };
    }

    let node = this.nodeName;
    try {
      // Test if current configured node works
      await this.request("GET", `/nodes/${node}/status`);
    } catch (err) {
      // Fallback: Query first online node
      try {
        const nodesList = await this.request("GET", "/nodes");
        if (nodesList && Array.isArray(nodesList)) {
          const activeNode = nodesList.find((n: any) => n.status === "online");
          if (activeNode) {
            node = activeNode.node;
          }
        }
      } catch (nodesErr) {
        console.error("Failed to query nodes fallback list:", nodesErr);
      }
    }

    try {
      const data = await this.request("GET", `/nodes/${node}/status`);
      const cpu = data.cpu || 0;
      const memory = data.memory || { used: 0, total: 1 };
      const disk = data.disk || { used: 0, total: 1 };
      const uptime = data.uptime || 0;

      return {
        cpuUsage: Math.round(cpu * 10000) / 100, // Converts 0.054 to 5.4%
        memoryUsage: Math.round((memory.used / memory.total) * 10000) / 100,
        diskUsage: Math.round((disk.used / disk.total) * 10000) / 100,
        uptime,
      };
    } catch (err: any) {
      console.error(`Proxmox getHostMetrics failed for node ${node}:`, err);
      throw new Error(`Falha ao obter métricas do Proxmox no nó ${node}: ${err.message || err}`);
    }
  }

  async listVMs(): Promise<VM[]> {
    if (this.isMock) {
      return ProxmoxProvider.mockVMs.map((vm) => {
        const isRunning = vm.status === "RUNNING";
        const isPaused = vm.status === "PAUSED";
        
        let cpuUsage = 0;
        let memoryUsed = 0;
        let uptime = 0;
        let netIn = 0;
        let netOut = 0;
        let diskUsed = 0;
        let cpuShares = 1024;

        if (isRunning) {
          const hash = parseInt(vm.id) || 100;
          cpuUsage = Math.round(((Math.sin(Date.now() / 5000 + hash) + 1) / 2) * 35 + 5); // 5% to 40%
          memoryUsed = Math.round(vm.memory * (0.3 + ((Math.cos(Date.now() / 8000 + hash) + 1) / 2) * 0.4)); // 30% to 70%
          uptime = Math.round((Date.now() - (hash * 100000)) / 1000) % 604800 + 3600;
          netIn = Math.round((Math.sin(Date.now() / 3000 + hash) + 1.2) * 1200000); // bytes/s
          netOut = Math.round((Math.cos(Date.now() / 4000 + hash) + 1.1) * 600000); // bytes/s
          diskUsed = Math.round(vm.disk * 0.42); // 42% of total disk
          cpuShares = 1000 + (hash % 10) * 10;
        } else if (isPaused) {
          cpuUsage = 0;
          memoryUsed = Math.round(vm.memory * 0.12);
          uptime = 0;
          diskUsed = Math.round(vm.disk * 0.42);
        } else {
          diskUsed = Math.round(vm.disk * 0.42);
        }

        return {
          ...vm,
          cpuUsage,
          memoryUsed,
          uptime,
          netIn,
          netOut,
          diskUsed,
          cpuShares,
        };
      });
    }

    try {
      // Try fetching cluster-wide resource list first (much more robust)
      let clusterResources: any[] = [];
      try {
        clusterResources = await this.request("GET", "/cluster/resources?type=vm");
      } catch (clusterErr) {
        console.warn("Failed to fetch /cluster/resources, falling back to node qemu:", clusterErr);
      }

      if (clusterResources && clusterResources.length > 0) {
        return clusterResources.map((item: any) => {
          let status: VM["status"] = "UNKNOWN";
          if (item.status === "running") status = "RUNNING";
          if (item.status === "stopped") status = "STOPPED";
          if (item.status === "paused") status = "PAUSED";

          return {
            id: String(item.vmid),
            name: item.name || `VM ${item.vmid}`,
            status,
            cpu: item.maxcpu || 1,
            memory: Math.round(item.maxmem / (1024 * 1024)), // Bytes to MB
            disk: Math.round(item.maxdisk / (1024 * 1024 * 1024)), // Bytes to GB
            ipAddress: undefined,
            node: item.node,
            cpuUsage: item.status === "running" && typeof item.cpu === "number" ? Math.round(item.cpu * 100) : 0,
            memoryUsed: item.status === "running" && typeof item.mem === "number" ? Math.round(item.mem / (1024 * 1024)) : 0,
            uptime: item.status === "running" && typeof item.uptime === "number" ? item.uptime : 0,
            netIn: item.status === "running" && typeof item.netin === "number" ? item.netin : 0,
            netOut: item.status === "running" && typeof item.netout === "number" ? item.netout : 0,
            diskUsed: typeof item.disk === "number" ? Math.round(item.disk / (1024 * 1024 * 1024)) : 0,
            cpuShares: typeof item.shares === "number" ? item.shares : 1024,
          };
        });
      }

      // Fallback: List node QEMU VMs specifically
      const qemuList = await this.request("GET", `/nodes/${this.nodeName}/qemu`);
      
      const vms: VM[] = qemuList.map((item: any) => {
        let status: VM["status"] = "UNKNOWN";
        if (item.status === "running") status = "RUNNING";
        if (item.status === "stopped") status = "STOPPED";
        if (item.status === "paused") status = "PAUSED";

        return {
          id: String(item.vmid),
          name: item.name || `VM ${item.vmid}`,
          status,
          cpu: item.cpus || 1,
          memory: Math.round(item.maxmem / (1024 * 1024)), // Bytes to MB
          disk: Math.round(item.maxdisk / (1024 * 1024 * 1024)), // Bytes to GB
          ipAddress: undefined,
          node: this.nodeName,
          cpuUsage: item.status === "running" && typeof item.cpu === "number" ? Math.round(item.cpu * 100) : 0,
          memoryUsed: item.status === "running" && typeof item.mem === "number" ? Math.round(item.mem / (1024 * 1024)) : 0,
          uptime: item.status === "running" && typeof item.uptime === "number" ? item.uptime : 0,
          netIn: item.status === "running" && typeof item.netin === "number" ? item.netin : 0,
          netOut: item.status === "running" && typeof item.netout === "number" ? item.netout : 0,
          diskUsed: typeof item.disk === "number" ? Math.round(item.disk / (1024 * 1024 * 1024)) : 0,
          cpuShares: typeof item.shares === "number" ? item.shares : 1024,
        };
      });

      return vms;
    } catch (err) {
      console.error("Proxmox listVMs failed:", err);
      return [];
    }
  }

  async startVM(vmId: string): Promise<boolean> {
    if (this.isMock) {
      const vm = ProxmoxProvider.mockVMs.find((v) => v.id === vmId);
      if (vm) {
        vm.status = "RUNNING";
        vm.ipAddress = vm.ipAddress || `192.168.1.${100 + Math.floor(Math.random() * 150)}`;
        return true;
      }
      return false;
    }

    try {
      const node = await this.resolveNodeForVM(vmId);
      await this.request("POST", `/nodes/${node}/qemu/${vmId}/status/start`);
      return true;
    } catch (err) {
      console.error(`Proxmox startVM failed for ${vmId}:`, err);
      return false;
    }
  }

  async stopVM(vmId: string): Promise<boolean> {
    if (this.isMock) {
      const vm = ProxmoxProvider.mockVMs.find((v) => v.id === vmId);
      if (vm) {
        vm.status = "STOPPED";
        return true;
      }
      return false;
    }

    try {
      const node = await this.resolveNodeForVM(vmId);
      // Default to shutdown (graceful), if that throws, we stop
      await this.request("POST", `/nodes/${node}/qemu/${vmId}/status/shutdown`);
      return true;
    } catch (err) {
      try {
        const node = await this.resolveNodeForVM(vmId);
        console.warn(`Shutdown failed, trying hard stop for VM ${vmId}:`, err);
        await this.request("POST", `/nodes/${node}/qemu/${vmId}/status/stop`);
        return true;
      } catch (stopErr) {
        console.error(`Proxmox stopVM/stop failed for ${vmId}:`, stopErr);
        return false;
      }
    }
  }

  async rebootVM(vmId: string): Promise<boolean> {
    if (this.isMock) {
      const vm = ProxmoxProvider.mockVMs.find((v) => v.id === vmId);
      if (vm) {
        vm.status = "RUNNING";
        return true;
      }
      return false;
    }

    try {
      const node = await this.resolveNodeForVM(vmId);
      await this.request("POST", `/nodes/${node}/qemu/${vmId}/status/reboot`);
      return true;
    } catch (err) {
      console.error(`Proxmox rebootVM failed for ${vmId}:`, err);
      return false;
    }
  }

  async deleteVM(vmId: string): Promise<boolean> {
    if (this.isMock) {
      const index = ProxmoxProvider.mockVMs.findIndex((v) => v.id === vmId);
      if (index !== -1) {
        ProxmoxProvider.mockVMs.splice(index, 1);
        return true;
      }
      return false;
    }

    try {
      const node = await this.resolveNodeForVM(vmId);
      await this.request("DELETE", `/nodes/${node}/qemu/${vmId}`);
      return true;
    } catch (err) {
      console.error(`Proxmox deleteVM failed for ${vmId}:`, err);
      return false;
    }
  }

  async updateVM(
    vmId: string,
    params: { name?: string; cpu?: number; memory?: number }
  ): Promise<boolean> {
    if (this.isMock) {
      const vm = ProxmoxProvider.mockVMs.find((v) => v.id === vmId);
      if (vm) {
        if (params.name !== undefined) vm.name = params.name;
        if (params.cpu !== undefined) vm.cpu = params.cpu;
        if (params.memory !== undefined) vm.memory = params.memory;
        return true;
      }
      return false;
    }

    try {
      const node = await this.resolveNodeForVM(vmId);
      const configParams: Record<string, any> = {};
      if (params.name !== undefined) configParams.name = params.name;
      if (params.cpu !== undefined) configParams.cores = params.cpu;
      if (params.memory !== undefined) configParams.memory = params.memory;

      await this.request("POST", `/nodes/${node}/qemu/${vmId}/config`, configParams);
      return true;
    } catch (err) {
      console.error(`Proxmox updateVM failed for ${vmId}:`, err);
      return false;
    }
  }

  async createVM(params: {
    name: string;
    cpu: number;
    memory: number;
    iso?: string | null;
    disks: { storage: string; size: number }[];
    node?: string;
  }): Promise<string | boolean> {
    if (this.isMock) {
      const nextId = String(Math.max(...ProxmoxProvider.mockVMs.map((v) => parseInt(v.id))) + 1);
      const totalDisk = params.disks.reduce((acc, d) => acc + d.size, 0);
      ProxmoxProvider.mockVMs.push({
        id: nextId,
        name: params.name,
        status: "STOPPED",
        cpu: params.cpu,
        memory: params.memory,
        disk: totalDisk,
        node: params.node || this.nodeName,
      });
      return nextId;
    }

    try {
      // Find a free VM ID
      const clusterNextIdData = await this.request("GET", "/cluster/nextid");
      const nextId = clusterNextIdData || "100";

      let node = params.node || this.nodeName;
      if (!params.node) {
        try {
          await this.request("GET", `/nodes/${node}/status`);
        } catch (err) {
          const nodesList = await this.request("GET", "/nodes");
          if (nodesList && Array.isArray(nodesList)) {
            const activeNode = nodesList.find((n: any) => n.status === "online");
            if (activeNode) {
              node = activeNode.node;
            }
          }
        }
      }

      // Build parameters for creating QEMU VM
      const body: Record<string, any> = {
        vmid: nextId,
        name: params.name,
        cores: params.cpu,
        memory: params.memory, // in MB
        scsihw: "virtio-scsi-pci",
        net0: "virtio,bridge=vmbr0",
      };

      // Add disks as virtio0, virtio1, virtio2...
      params.disks.forEach((disk, idx) => {
        body[`virtio${idx}`] = `${disk.storage}:${disk.size},discard=on`;
      });

      // Add CDROM drive (ISO)
      if (params.iso) {
        body["ide2"] = `${params.iso},media=cdrom`;
      } else {
        body["ide2"] = "none,media=cdrom"; // Empty CDROM
      }

      await this.request("POST", `/nodes/${node}/qemu`, body);
      return String(nextId);
    } catch (err: any) {
      console.error("Proxmox createVM failed:", err);
      throw new Error(err.message || "Falha desconhecida no Proxmox.");
    }
  }

  async listISOs(): Promise<{ volid: string; name: string }[]> {
    if (this.isMock) {
      return [
        { volid: "local:iso/debian-12.5.0-amd64-netinst.iso", name: "debian-12.5.0-amd64-netinst.iso" },
        { volid: "local:iso/ubuntu-24.04-live-server-amd64.iso", name: "ubuntu-24.04-live-server-amd64.iso" },
        { volid: "local:iso/alpine-standard-3.20.0-x86_64.iso", name: "alpine-standard-3.20.0-x86_64.iso" },
      ];
    }

    try {
      let node = this.nodeName;
      try {
        await this.request("GET", `/nodes/${node}/status`);
      } catch (err) {
        const nodesList = await this.request("GET", "/nodes");
        if (nodesList && Array.isArray(nodesList)) {
          const activeNode = nodesList.find((n: any) => n.status === "online");
          if (activeNode) {
            node = activeNode.node;
          }
        }
      }

      const storages: any[] = await this.request("GET", `/nodes/${node}/storage`);
      const isoStorages = storages.filter(s => s.content && s.content.includes("iso") && s.active === 1);

      const isoList: { volid: string; name: string }[] = [];
      for (const storage of isoStorages) {
        try {
          const contents: any[] = await this.request("GET", `/nodes/${node}/storage/${storage.storage}/content?content=iso`);
          if (contents && Array.isArray(contents)) {
            contents.forEach(item => {
              if (item.content === "iso") {
                const name = item.volid.split("/").pop() || item.volid;
                isoList.push({ volid: item.volid, name });
              }
            });
          }
        } catch (err) {
          console.warn(`Failed to list ISOs for storage ${storage.storage} on node ${node}:`, err);
        }
      }
      return isoList;
    } catch (err) {
      console.error("Proxmox listISOs failed:", err);
      return [];
    }
  }

  async listStorages(): Promise<{ 
    name: string; 
    type: string; 
    active: boolean; 
    shared: boolean; 
    size?: number; 
    used?: number; 
    avail?: number; 
  }[]> {
    if (this.isMock) {
      return [
        { name: "local-lvm", type: "lvmthin", active: true, shared: false, size: 500 * 1024 * 1024 * 1024, used: 200 * 1024 * 1024 * 1024, avail: 300 * 1024 * 1024 * 1024 },
        { name: "local", type: "dir", active: true, shared: false, size: 100 * 1024 * 1024 * 1024, used: 40 * 1024 * 1024 * 1024, avail: 60 * 1024 * 1024 * 1024 },
        { name: "ceph-vm", type: "rbd", active: true, shared: true, size: 2000 * 1024 * 1024 * 1024, used: 800 * 1024 * 1024 * 1024, avail: 1200 * 1024 * 1024 * 1024 },
      ];
    }

    try {
      let node = this.nodeName;
      try {
        await this.request("GET", `/nodes/${node}/status`);
      } catch (err) {
        const nodesList = await this.request("GET", "/nodes");
        if (nodesList && Array.isArray(nodesList)) {
          const activeNode = nodesList.find((n: any) => n.status === "online");
          if (activeNode) {
            node = activeNode.node;
          }
        }
      }

      const storages: any[] = await this.request("GET", `/nodes/${node}/storage`);
      const imageStorages = storages.filter(s => s.content && s.content.includes("images") && s.active === 1);
      return imageStorages.map(s => ({
        name: s.storage,
        type: s.type,
        active: s.active === 1,
        shared: s.shared === 1,
        size: s.total,
        used: s.used,
        avail: s.avail,
      }));
    } catch (err) {
      console.error("Proxmox listStorages failed:", err);
      return [];
    }
  }

  async listNodes(): Promise<{
    name: string;
    status: "ONLINE" | "OFFLINE";
    cpuUsage: number;
    memoryUsage: number;
    memoryTotal: number;
    memoryUsed: number;
    uptime: number;
  }[]> {
    if (this.isMock) {
      return [
        {
          name: this.nodeName,
          status: "ONLINE",
          cpuUsage: 12,
          memoryUsage: 45,
          memoryTotal: 32768,
          memoryUsed: 14745,
          uptime: 86400,
        },
        {
          name: `${this.nodeName}-node-2`,
          status: "ONLINE",
          cpuUsage: 25,
          memoryUsage: 60,
          memoryTotal: 16384,
          memoryUsed: 9830,
          uptime: 124800,
        }
      ];
    }

    try {
      const nodesData = await this.request("GET", "/nodes");
      if (!nodesData || !Array.isArray(nodesData)) {
        return [];
      }

      return nodesData.map((node: any) => {
        const cpuUsage = Math.round((node.cpu || 0) * 100);
        const maxMem = node.maxmem || 1;
        const usedMem = node.mem || 0;
        const memoryUsage = Math.round((usedMem / maxMem) * 100);

        return {
          name: node.node,
          status: node.status === "online" ? "ONLINE" : "OFFLINE",
          cpuUsage,
          memoryUsage,
          memoryTotal: Math.round(maxMem / (1024 * 1024)),
          memoryUsed: Math.round(usedMem / (1024 * 1024)),
          uptime: node.uptime || 0,
        };
      });
    } catch (err) {
      console.error("Proxmox listNodes failed:", err);
      return [
        {
          name: this.nodeName,
          status: "ONLINE",
          cpuUsage: 0,
          memoryUsage: 0,
          memoryTotal: 0,
          memoryUsed: 0,
          uptime: 0,
        }
      ];
    }
  }

  async createVncProxy(vmId: string): Promise<{ ticket: string; port: number; apiPort: number; host: string; node: string } | null> {
    if (this.isMock) return null;
    try {
      const node = await this.resolveNodeForVM(vmId);
      const data = await this.request("POST", `/nodes/${node}/qemu/${vmId}/vncproxy`, { websocket: 1 });
      return {
        ticket: data.ticket,
        port: data.port,
        apiPort: this.port,
        host: this.host.replace(/^https?:\/\//, ""),
        node: node
      };
    } catch (err) {
      console.error(`Proxmox createVncProxy failed for ${vmId}:`, err);
      return null;
    }
  }

  async createTermProxy(nodeName?: string): Promise<{ ticket: string; port: number; apiPort: number; host: string; node: string } | null> {
    if (this.isMock) return null;
    try {
      const node = nodeName || this.nodeName;
      const data = await this.request("POST", `/nodes/${node}/termproxy`, { websocket: 1 });
      return {
        ticket: data.ticket,
        port: data.port,
        apiPort: this.port,
        host: this.host.replace(/^https?:\/\//, ""),
        node: node
      };
    } catch (err) {
      console.error(`Proxmox createTermProxy failed for node ${nodeName}:`, err);
      return null;
    }
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    if (this.isMock) return {};
    const isToken = this.credential.includes("PVEAPIToken=") || this.username.includes("!");
    if (isToken) {
      if (this.credential.startsWith("PVEAPIToken=")) {
        return { "Authorization": this.credential };
      } else {
        return { "Authorization": `PVEAPIToken=${this.username}=${this.credential}` };
      }
    } else {
      const agent = new https.Agent({ rejectUnauthorized: false });
      try {
        const loginRes = await this.loginTicket(agent);
        return { "Cookie": `PVEAuthCookie=${loginRes.ticket}` };
      } catch (err) {
        console.error("Failed to login to Proxmox to get auth headers", err);
        return {};
      }
    }
  }
}
