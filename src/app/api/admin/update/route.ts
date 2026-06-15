import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

// Path to store status
const STATUS_FILE = path.join(process.cwd(), "update-status.json");

function getStatus() {
  if (!fs.existsSync(STATUS_FILE)) {
    return { status: "idle", log: "", error: null };
  }
  try {
    return JSON.parse(fs.readFileSync(STATUS_FILE, "utf-8"));
  } catch (err) {
    return { status: "idle", log: "", error: null };
  }
}

async function getGitHubToken() {
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }
  try {
    const { stdout } = await execAsync("git remote get-url origin");
    const remoteUrl = stdout.trim();
    const match = remoteUrl.match(/https:\/\/([^:]+|[^@]+)@github\.com/);
    if (match && match[1]) {
      return match[1];
    }
  } catch (err) {}
  return null;
}

function getLocalVersion(): string {
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    return packageJson.version || "0.1.0";
  } catch (err) {
    return "0.1.0";
  }
}

async function getRemoteVersion(): Promise<string | null> {
  try {
    const token = await getGitHubToken();
    const headers: Record<string, string> = {
      "User-Agent": "NodeCommander-Update-Agent",
      "Accept": "application/vnd.github.v3.raw"
    };
    if (token) {
      headers["Authorization"] = `token ${token}`;
    }

    const res = await fetch("https://api.github.com/repos/GuilhermeAzespo/NodeCommander/contents/package.json", {
      headers,
      next: { revalidate: 60 } // cache for 1 minute
    });
    if (!res.ok) {
      throw new Error(`GitHub API returned ${res.status}`);
    }
    
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && parsed.content && parsed.encoding === "base64") {
        const decoded = Buffer.from(parsed.content, "base64").toString("utf-8");
        return JSON.parse(decoded).version || "0.1.0";
      }
      return parsed.version || "0.1.0";
    } catch (e) {
      const parsed = JSON.parse(text);
      return parsed.version || "0.1.0";
    }
  } catch (err: any) {
    console.error("Failed to fetch remote version:", err);
    return null;
  }
}

function isVersionNewer(local: string, remote: string): boolean {
  const localParts = local.split(".").map(Number);
  const remoteParts = remote.split(".").map(Number);
  
  for (let i = 0; i < 3; i++) {
    const r = remoteParts[i] || 0;
    const l = localParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const localVersion = getLocalVersion();
  const remoteVersion = await getRemoteVersion();
  const statusInfo = getStatus();

  const updateAvailable = remoteVersion ? isVersionNewer(localVersion, remoteVersion) : false;

  return NextResponse.json({
    localVersion,
    remoteVersion,
    status: statusInfo.status,
    log: statusInfo.log,
    error: statusInfo.error,
    updateAvailable
  });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const statusInfo = getStatus();
  if (statusInfo.status === "updating") {
    return NextResponse.json({ error: "Uma atualização já está em andamento." }, { status: 400 });
  }

  // Set status to updating
  const initialStatus = { status: "updating", log: "Iniciando atualização...\n", error: null };
  fs.writeFileSync(STATUS_FILE, JSON.stringify(initialStatus, null, 2));

  // Run update process in the background
  runUpdateInBackground();

  return NextResponse.json({ status: "updating", message: "Atualização iniciada em segundo plano." });
}

function runUpdateInBackground() {
  const logStream = (message: string) => {
    try {
      const current = getStatus();
      current.log += message;
      fs.writeFileSync(STATUS_FILE, JSON.stringify(current, null, 2));
    } catch (err) {}
  };

  const setFinalStatus = (status: string, error: string | null = null) => {
    try {
      const current = getStatus();
      current.status = status;
      current.error = error;
      fs.writeFileSync(STATUS_FILE, JSON.stringify(current, null, 2));
    } catch (err) {}
  };

  const steps = [
    { cmd: "git", args: ["pull"] },
    { cmd: "npm", args: ["install"] },
    { cmd: "npx", args: ["prisma", "generate"] },
    { cmd: "npx", args: ["prisma", "db", "push"] },
    { cmd: "npm", args: ["run", "build"] }
  ];

  let currentStep = 0;

  const executeNext = () => {
    if (currentStep >= steps.length) {
      logStream("\nBuild concluído com sucesso! Reiniciando o servidor...\n");
      setFinalStatus("success");
      
      // Trigger PM2 restart in a separate process that executes after 2 seconds
      setTimeout(() => {
        const restartProc = spawn("pm2", ["restart", "node-commander"], {
          detached: true,
          stdio: "ignore",
          shell: true
        });
        restartProc.unref();
      }, 2000);
      return;
    }

    const step = steps[currentStep];
    logStream(`\n> Executando: ${step.cmd} ${step.args.join(" ")}\n`);

    const proc = spawn(step.cmd, step.args, { shell: true });

    proc.stdout.on("data", (data) => {
      logStream(data.toString());
    });

    proc.stderr.on("data", (data) => {
      logStream(data.toString());
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        logStream(`\nErro: O comando falhou com o código ${code}\n`);
        setFinalStatus("failed", `Falha ao executar ${step.cmd}`);
      } else {
        currentStep++;
        executeNext();
      }
    });
  };

  executeNext();
}
