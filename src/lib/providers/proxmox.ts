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
    } catch (err) {
      console.error(`Proxmox getHostMetrics failed for node ${node}:`, err);
      return { cpuUsage: 0, memoryUsage: 0, diskUsage: 0, uptime: 0 };
    }
  }

  async listVMs(): Promise<VM[]> {
    if (this.isMock) {
      return ProxmoxProvider.mockVMs;
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
            name: item.name,
            status,
            cpu: item.maxcpu || 1,
            memory: Math.round(item.maxmem / (1024 * 1024)), // Bytes to MB
            disk: Math.round(item.maxdisk / (1024 * 1024 * 1024)), // Bytes to GB
            ipAddress: undefined,
            node: item.node,
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
          name: item.name,
          status,
          cpu: item.cpus || 1,
          memory: Math.round(item.maxmem / (1024 * 1024)), // Bytes to MB
          disk: Math.round(item.maxdisk / (1024 * 1024 * 1024)), // Bytes to GB
          ipAddress: undefined,
          node: this.nodeName,
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

  async createVM(params: { name: string; cpu: number; memory: number; disk: number; image: string }): Promise<boolean> {
    if (this.isMock) {
      const nextId = String(Math.max(...ProxmoxProvider.mockVMs.map((v) => parseInt(v.id))) + 1);
      ProxmoxProvider.mockVMs.push({
        id: nextId,
        name: params.name,
        status: "STOPPED",
        cpu: params.cpu,
        memory: params.memory,
        disk: params.disk,
      });
      return true;
    }

    try {
      // Find a free VM ID
      const clusterNextIdData = await this.request("GET", "/cluster/nextid");
      const nextId = clusterNextIdData || "100";

      // Build parameters for creating QEMU VM
      const body = {
        vmid: nextId,
        name: params.name,
        cores: params.cpu,
        memory: params.memory, // in MB
        scsihw: "virtio-scsi-pci",
        // We add disk depending on what storage exists. Standard storage is local-lvm or local
        virtio0: `local-lvm:${params.disk},discard=on`,
        net0: "virtio,bridge=vmbr0",
      };

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

      await this.request("POST", `/nodes/${node}/qemu`, body);
      return true;
    } catch (err) {
      console.error("Proxmox createVM failed:", err);
      return false;
    }
  }

  async createVncProxy(vmId: string): Promise<{ ticket: string; port: number; host: string; node: string } | null> {
    if (this.isMock) return null;
    try {
      const node = await this.resolveNodeForVM(vmId);
      const data = await this.request("POST", `/nodes/${node}/qemu/${vmId}/vncproxy`, { websocket: 1 });
      return {
        ticket: data.ticket,
        port: data.port,
        host: this.host.replace(/^https?:\/\//, ""),
        node: node
      };
    } catch (err) {
      console.error(`Proxmox createVncProxy failed for ${vmId}:`, err);
      return null;
    }
  }

  async createTermProxy(nodeName?: string): Promise<{ ticket: string; port: number; host: string; node: string } | null> {
    if (this.isMock) return null;
    try {
      const node = nodeName || this.nodeName;
      const data = await this.request("POST", `/nodes/${node}/termproxy`, { websocket: 1 });
      return {
        ticket: data.ticket,
        port: data.port,
        host: this.host.replace(/^https?:\/\//, ""),
        node: node
      };
    } catch (err) {
      console.error(`Proxmox createTermProxy failed for node ${nodeName}:`, err);
      return null;
    }
  }
}
