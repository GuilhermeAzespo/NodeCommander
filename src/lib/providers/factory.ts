import { prisma } from "../db";
import { decrypt } from "../crypto";
import { HypervisorProvider } from "./provider";
import { ProxmoxProvider } from "./proxmox";

export async function getProviderForHypervisor(hypervisorId: string): Promise<HypervisorProvider> {
  const hypervisor = await prisma.hypervisor.findUnique({
    where: { id: hypervisorId }
  });

  if (!hypervisor) {
    throw new Error(`Hipervisor com ID ${hypervisorId} não encontrado.`);
  }

  const decryptedCredential = decrypt(hypervisor.credential);

  if (hypervisor.type === "PROXMOX") {
    return new ProxmoxProvider(
      hypervisor.host,
      hypervisor.port,
      hypervisor.username,
      decryptedCredential,
      hypervisor.nodeName
    );
  }

  throw new Error(`Tipo de hipervisor não suportado: ${hypervisor.type}`);
}
