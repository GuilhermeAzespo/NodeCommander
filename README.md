# 🚀 NodeCommander

O **NodeCommander** é um painel administrativo de alta performance projetado para centralizar e simplificar o gerenciamento de múltiplos hypervisors de virtualização. Inicialmente integrado de forma nativa com o **Proxmox VE**, o projeto foi estruturado com foco em baixa latência, segurança ponta a ponta, monitoramento em tempo real e escalabilidade para futuras integrações (como VMware ESXi e Hyper-V).

---

## ✨ Funcionalidades Principais

*   **📊 Dashboard & Monitoramento em Tempo Real:** 
    *   Visão consolidada da infraestrutura, exibindo o número de nós online e máquinas virtuais.
    *   Painel de monitoramento customizável com suporte a *Drag and Drop*, permitindo organizar widgets de telemetria, médias de uso de CPU/RAM, tráfego de rede e armazenamento.
    *   Criação de múltiplos painéis personalizados (Dashboards).
*   **💻 Acesso Remoto (SSH e noVNC):**
    *   **Console SSH Integrado (Multi-Abas):** Acesse o terminal de seus servidores sem sair do navegador. Suporta múltiplas sessões simultâneas (abas invisíveis) com sistema de *Keepalive* para evitar quedas por inatividade.
    *   **Integração 1-Click:** Botão de acesso rápido SSH diretamente na listagem de Máquinas Virtuais.
    *   **noVNC HTML5:** Controle total da tela (teclado e mouse) das suas VMs direto pelo navegador.
*   **⚙️ Gestão de Hipervisores (Nós):** 
    *   Cadastro, edição e exclusão de nós Proxmox VE com teste de comunicação instantâneo.
*   **📦 Ciclo de Vida de VMs & Templates:** 
    *   Comandos rápidos para ligar (`START`), desligar (`STOP`), pausar (`PAUSE`), reiniciar (`REBOOT`) e excluir máquinas virtuais.
    *   Assistente (*Wizard*) passo a passo para provisionamento rápido de recursos computacionais (alocação de vCPUs, RAM, Disco e Imagem base).
    *   Suporte à criação e implantação através de **Templates Customizados**.
*   **🔐 Controle de Acesso Baseado em Cargos (RBAC):**
    *   **ADMIN:** Acesso total a todas as configurações, usuários, SMTP e nós.
    *   **OPERATOR:** Acesso granular. Pode receber acesso a nós específicos com permissões personalizadas de ciclo de vida (`VIEW`, `CONTROL` ou `FULL`).
    *   **VIEWER:** Permissão estrita de leitura para nós específicos.
*   **📧 Alertas por E-mail (SMTP):** 
    *   Disparo automático de e-mails de alerta a administradores no caso de ações críticas de energia, exclusões de máquinas virtuais, e novos acessos.
*   **🛡️ Segurança de Credenciais:** 
    *   Criptografia simétrica bidirecional (`AES-256-CBC`) para salvar com segurança as chaves de API e senhas dos hipervisores no banco de dados.

---

## 🛠️ Tecnologias Utilizadas

*   **Frontend & Backend:** [Next.js 16 (App Router)](https://nextjs.org/) + TypeScript.
*   **Estilização:** [Tailwind CSS v4](https://tailwindcss.com/) (Tema escuro premium com visual glassmorphic) + [Lucide Icons](https://lucide.dev/).
*   **Banco de Dados:** SQLite via [Prisma ORM](https://www.prisma.io/) utilizando o adaptador de alto desempenho `better-sqlite3`.
*   **Monitoramento & WebSockets:** Integrações via APIs HTTP do Proxmox e WebSocket puro (`ws`) para consoles SSH/noVNC.
*   **Autenticação:** Tokens JWT mantidos em cookies HttpOnly super seguros.

---

## 📦 Instalação e Configuração (Ambiente de Produção via PM2)

### Requisitos Pró-Requisitos
*   Node.js 20 ou superior.
*   npm ou yarn.
*   PM2 instalado globalmente (`npm install -g pm2`).

### 1. Clonar o Repositório e Instalar Dependências
```bash
git clone https://github.com/GuilhermeAzespo/NodeCommander.git
cd NodeCommander
npm install
```

### 2. Configurar Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto e configure as chaves criptográficas:
```env
DATABASE_URL="file:./dev.db"
# Gere hashes seguros para a produção:
ENCRYPTION_KEY="substitua_por_uma_chave_aes_de_32_caracteres_no_minimo"
JWT_SECRET="substitua_por_uma_chave_secreta_longa_e_aleatoria"
```
> ⚠️ **Importante:** Em ambientes de produção, substitua `ENCRYPTION_KEY` e `JWT_SECRET` por strings secretas de alta entropia.

### 3. Rodar Migrações do Banco de Dados
Gere a estrutura de tabelas SQLite no banco de dados local:
```bash
npx prisma migrate dev --name init
```

### 4. Popular o Banco (Seeding Inicial)
O projeto conta com um script de seed que cria o primeiro acesso administrativo e a estrutura padrão de configurações SMTP:
```bash
npx tsx prisma/seed.ts
```

### 5. Executar o Build de Produção
Para melhor performance, faça o build do projeto:
```bash
npm run build
```

### 6. Iniciar a Aplicação com PM2
Para garantir que a aplicação rode em segundo plano e reinicie automaticamente:
```bash
pm2 start npm --name "node-commander" -- run start
pm2 save
```
O NodeCommander estará rodando localmente (normalmente na porta `3000`).

---

## 🔑 Informações de Primeiro Acesso

Após executar o script de **seed** (Etapa 4), utilize as credenciais padrão abaixo para acessar o painel pela primeira vez:

*   **E-mail:** `admin@nodecommander.com`
*   **Senha:** `admin123`

> 🔒 **Recomendação de Segurança:** Após fazer login pela primeira vez, navegue até a aba **Usuários e Permissões** e edite a senha da conta de Administrador para uma senha forte de sua preferência.

---

## ⚙️ Testes e Modo de Demonstração (Mock)
Caso queira testar a interface e os relatórios do NodeCommander sem possuir um cluster Proxmox VE físico configurado:
1. Vá até a aba **Hipervisores**.
2. Clique em **Novo Hipervisor**.
3. Preencha o host como `mock` (ex: Nome: `Proxmox Lab`, Host: `mock`, Porta: `8006`, Usuário: `root@pam`).
4. Ao salvar, o sistema ativará o **Provedor Mock**, gerando estatísticas de host simuladas e uma lista de máquinas virtuais interativas para você validar os gráficos de Monitoramento, os ciclos de energia e o wizard de criação sem afetar nada real.