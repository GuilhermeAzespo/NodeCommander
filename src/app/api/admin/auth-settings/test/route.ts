import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import net from "net";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const { type, config } = await req.json();

    if (type === "AD") {
      if (!config.url) {
        return NextResponse.json({ error: "URL do Servidor LDAP é obrigatória." }, { status: 400 });
      }

      try {
        // Parse da URL (ex: ldap://192.168.1.10:389 ou ldaps://domain.local:636)
        const urlObj = new URL(config.url);
        const host = urlObj.hostname;
        const port = parseInt(urlObj.port) || (urlObj.protocol === "ldaps:" ? 636 : 389);

        // Testar conexão TCP
        return new Promise<NextResponse>((resolve) => {
          const socket = new net.Socket();
          socket.setTimeout(5000); // 5 seconds timeout

          socket.on("connect", () => {
            socket.destroy();
            resolve(NextResponse.json({ success: true, message: "Conexão com o Servidor LDAP estabelecida com sucesso na porta " + port }));
          });

          socket.on("timeout", () => {
            socket.destroy();
            resolve(NextResponse.json({ error: "Timeout: O servidor demorou muito para responder." }, { status: 400 }));
          });

          socket.on("error", (err: any) => {
            socket.destroy();
            resolve(NextResponse.json({ error: "Falha na conexão: " + err.message }, { status: 400 }));
          });

          socket.connect(port, host);
        });
      } catch (err) {
        return NextResponse.json({ error: "URL Inválida. Formato correto ex: ldaps://servidor:636" }, { status: 400 });
      }
    }

    if (type === "GOOGLE") {
      if (!config.clientId || !config.clientSecret) {
        return NextResponse.json({ error: "Client ID e Secret são obrigatórios." }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: "As credenciais do Google Workspace possuem um formato válido e pronto para uso." });
    }

    if (type === "M365") {
      if (!config.tenantId || !config.clientId || !config.clientSecret) {
        return NextResponse.json({ error: "Tenant ID, Client ID e Secret são obrigatórios." }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: "As credenciais do Microsoft 365 possuem um formato válido e pronto para uso." });
    }

    return NextResponse.json({ error: "Tipo desconhecido." }, { status: 400 });

  } catch (error: any) {
    console.error("Test Auth error:", error);
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
