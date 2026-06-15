# NodeCommander

O **NodeCommander** é um painel administrativo de alta performance projetado para centralizar o gerenciamento de múltiplos hypervisors de virtualização. Inicialmente integrado com o **Proxmox VE**, o projeto foi estruturado com foco em baixa latência, segurança ponta a ponta e escalabilidade para futuras integrações (como VMware ESXi e Hyper-V).

---

## 🚀 Funcionalidades Principais

*   **Painel Centralizado (Dashboard):** Visão consolidada da infraestrutura, exibindo o número de nós online, total de máquinas virtuais operando e logs de auditoria recentes.
*   **Gestão de Hipervisores (Nós):** Cadastro, edição e exclusão de nós Proxmox VE com teste de comunicação instantâneo.
*   **Ciclo de Vida de VMs:** Comandos rápidos para ligar (`START`), desligar (`STOP`), reiniciar (`REBOOT`) e deletar máquinas virtuais.
*   **Wizard de Criação de VMs:** Assistente passo a passo para provisionamento rápido de recursos computacionais (alocação de vCPUs, RAM, Disco e Imagem base).
*   **Controle de Acesso Escopado (RBAC):**
    *   **ADMIN:** Acesso total a todas as configurações, usuários, SMTP e nós.
    *   **OPERATOR:** Nível configurável. Pode receber acesso a nós específicos com permissões personalizadas de ciclo de vida (`VIEW`, `CONTROL` ou `FULL`).
    *   **VIEWER:** Permissão de apenas leitura para nós específicos.
*   **Alertas por E-mail (SMTP):** Disparo automático de e-mails de alerta a administradores no caso de ações críticas de energia ou deleções de máquinas virtuais.
*   **Segurança de Credenciais:** Criptografia simétrica bidirecional (`AES-256-CBC`) para salvar com segurança as chaves de API e senhas dos hipervisores no banco de dados.

---

## 🛠️ Tecnologias Utilizadas

*   **Frontend & Backend:** [Next.js 16 (App Router)](https://nextjs.org/) + TypeScript.
*   **Estilização:** [Tailwind CSS v4](https://tailwindcss.com/) (Tema escuro premium com visual glassmorphic).
*   **Banco de Dados:** SQLite via [Prisma ORM](https://www.prisma.io/) utilizando o adaptador de alto desempenho `better-sqlite3`.
*   **Autenticação:** Tokens JWT guardados em cookies HttpOnly seguros.
*   **Notificações:** [Nodemailer](https://nodemailer.com/) para disparo de SMTP.

---

## 📦 Instalação e Configuração

### Requisitos Pró-Requisitos
*   Node.js 20 ou superior.
*   npm ou yarn.

### 1. Clonar o Repositório e Instalar Dependências
```bash
git clone https://github.com/GuilhermeAzespo/NodeCommander.git
cd NodeCommander
npm install
```

### 2. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto e configure as seguintes chaves:
```env
DATABASE_URL="file:./dev.db"
ENCRYPTION_KEY="nodecommander_encryption_secret_key_2026_32bytes"
JWT_SECRET="nodecommander_jwt_secret_token_key_2026_supersecure"
```
> ⚠️ **Importante:** Em ambientes de produção, substitua `ENCRYPTION_KEY` e `JWT_SECRET` por strings secretas de alta entropia.

### 3. Rodar Migrações do Banco de Dados
Gere a estrutura de tabelas SQLite no banco de dados local:
```bash
npx prisma migrate dev --name init
```

### 4. Popular o Banco (Seeding)
O projeto conta com um script de seed que cria o primeiro acesso administrativo e a estrutura padrão de configurações SMTP:
```bash
npx tsx prisma/seed.ts
```

### 5. Executar o Servidor de Desenvolvimento
Inicie o console local:
```bash
npm run dev
```
Acesse `http://localhost:3000` no seu navegador.

---

## 🔑 Informações de Primeiro Acesso

Após executar o script de **seed** (Etapa 4), utilize as credenciais padrão abaixo para acessar o painel pela primeira vez:

*   **E-mail:** `admin@nodecommander.com`
*   **Senha:** `admin123`

> 🔒 **Recomendação de Segurança:** Após fazer login pela primeira vez, navegue até a aba **Usuários e Permissões** e edite a senha da conta de Administrador para uma senha forte de sua preferência.

---

## ⚙️ Testes e Modo de Demonstração (Mock)
Caso queira testar a interface do NodeCommander sem possuir um cluster Proxmox VE físico configurado:
1. Vá até a aba **Hipervisores**.
2. Clique em **Novo Hipervisor**.
3. Preencha o host como `mock` (ex: Nome: `Proxmox Lab`, Host: `mock`, Porta: `8006`, Usuário: `root@pam`).
4. Ao clicar em **Testar Conexão** ou **Salvar**, o sistema ativará o Provedor Mock, gerando estatísticas de host simuladas e uma lista de máquinas virtuais interativas para você validar os ciclos de energia e o wizard de criação.