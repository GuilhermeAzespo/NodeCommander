-- CreateTable
CREATE TABLE "VmIPOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hypervisorId" TEXT NOT NULL,
    "vmId" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "VmIPOverride_hypervisorId_vmId_key" ON "VmIPOverride"("hypervisorId", "vmId");
