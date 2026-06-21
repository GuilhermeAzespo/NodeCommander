# 🚀 NodeCommander

O **NodeCommander** é um painel de controle centralizado para gerenciar múltiplos hypervisores Proxmox VE. Criado com foco na modernidade, simplicidade e segurança, ele oferece uma interface unificada onde você pode monitorar suas máquinas virtuais, visualizar recursos e acessar seus servidores remotamente de forma rápida e segura.

---

## 🌟 Principais Funcionalidades

- **Gerenciamento Unificado:** Adicione e monitore múltiplos servidores Proxmox VE em um único painel.
- **Console Remoto Web (NoVNC):** Acesse a interface gráfica ou terminal de qualquer máquina virtual diretamente do seu navegador, sem precisar logar no painel nativo do Proxmox.
- **Sistema de Autenticação Robusto:** 
  - Suporte a Múltiplos Fatores de Autenticação (2FA/TOTP).
  - Integrações prontas com Active Directory (LDAP), Google e Microsoft 365.
- **Níveis de Acesso (RBAC):** Controle de permissões refinado com cargos de Administrador, Operador e Visualizador.
- **Monitoramento e Logs:** Registro detalhado de atividades e auditoria.
- **Atualização com 1 Clique (OTA):** Atualize o sistema inteiro (Pull, Build e Restart) direto pela interface da web de forma invisível.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend & Backend:** [Next.js](https://nextjs.org/) (App Router) + React + TypeScript
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/) com design escuro, moderno e responsivo
- **Banco de Dados:** SQLite, gerenciado via [Prisma ORM](https://www.prisma.io/)
- **Proxies de Conexão:** WebSockets e `http-proxy` para as pontes VNC/SSH seguras
- **Gerenciamento de Processos:** PM2 (para produção)

---

## 📦 Como Instalar e Rodar

O NodeCommander foi projetado para rodar em ambientes Linux ou Windows através do Node.js.

### Pré-requisitos
- Node.js (v18 ou superior)
- NPM ou Yarn
- Git (para as atualizações automáticas)
- PM2 (recomendado para rodar em produção)

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/GuilhermeAzespo/NodeCommander.git
   cd NodeCommander
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as Variáveis de Ambiente:**
   - Crie um arquivo `.env` na raiz do projeto. O próprio sistema possui um script que irá gerar chaves seguras automaticamente se o `.env` estiver vazio ao iniciar, mas o arquivo base se parece com isso:
   ```env
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="sua-chave-secreta-muito-longa-aqui"
   SESSION_SECRET="outra-chave-secreta-longa-para-cookies"
   ```

4. **Prepare o Banco de Dados:**
   - Gere o cliente Prisma e sincronize a estrutura do banco:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
   *(Atenção: o primeiro usuário criado no sistema automaticamente receberá o cargo de Administrador).*

5. **Rode em Ambiente de Desenvolvimento:**
   ```bash
   npm run dev
   ```

6. **Rode em Ambiente de Produção (Recomendado):**
   ```bash
   npm run build
   pm2 start npm --name "node-commander" -- start
   ```

---

## 🔄 Atualizando o Sistema

Você não precisa rodar comandos manuais para atualizar.
1. Acesse o NodeCommander logado como **Administrador**.
2. Vá até a aba lateral **"Atualização do Sistema"**.
3. Clique em **"Buscar Atualizações"**.
4. Se o botão para confirmar aparecer, o sistema baixará o novo código do GitHub, instalará novas dependências, reconstruirá a aplicação e reiniciará o servidor automaticamente (cerca de 20 segundos de downtime).

---

## 🤝 Contribuição

Contribuições são muito bem-vindas! Se você encontrou um bug ou tem uma ideia para uma nova funcionalidade, sinta-se à vontade para abrir uma *Issue* ou enviar um *Pull Request*.

## 📄 Licença

Este projeto é desenvolvido para uso privado/pessoal. Entre em contato para mais detalhes sobre os termos de distribuição e licenciamento.