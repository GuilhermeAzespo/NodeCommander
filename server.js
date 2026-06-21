require('next/dist/lib/load-env-config').loadEnvConfig(process.cwd());

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const httpProxy = require('http-proxy');
const jwt = require('jsonwebtoken');
const { WebSocketServer } = require('ws');
const { Client: SshClient } = require('ssh2');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const proxy = httpProxy.createProxyServer({
  ws: true,
  secure: false,
});

proxy.on('error', (err, req, res) => {
  console.error('Proxy Error:', err);
  if (res && res.writeHead) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Proxy Error');
  }
});

// ─── Crypto helpers (mirror of src/lib/crypto.ts) ────────────────────────────
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'nodecommander_encryption_secret_key_2026_32bytes';

function decryptPassword(text) {
  if (!text) return '';
  try {
    const textParts = text.split(':');
    const ivHex = textParts.shift();
    if (!ivHex) return '';
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const key = Buffer.concat([Buffer.from(ENCRYPTION_KEY)], 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    return text;
  }
}

// ─── Get SSH session from SQLite directly ────────────────────────────────────
function getSshSession(sessionId) {
  try {
    const dbPath = path.join(process.cwd(), 'dev.db');
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare('SELECT * FROM SshSession WHERE id = ?').get(sessionId);
    db.close();
    return row || null;
  } catch (err) {
    console.error('[SSH] Failed to query SshSession:', err);
    return null;
  }
}

// ─── SSH WebSocket handler ────────────────────────────────────────────────────
function handleSshWebSocket(ws, sessionId) {
  const session = getSshSession(sessionId);
  if (!session) {
    ws.send(JSON.stringify({ type: 'error', message: 'Sessão SSH não encontrada.' }));
    ws.close();
    return;
  }

  const password = decryptPassword(session.password);
  const conn = new SshClient();

  conn.on('ready', () => {
    console.log(`[SSH] Connected to ${session.host}:${session.port} as ${session.username}`);
    ws.send(JSON.stringify({ type: 'status', message: 'connected' }));

    conn.shell({ term: 'xterm-256color', cols: 220, rows: 50 }, (err, stream) => {
      if (err) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
        conn.end();
        return;
      }

      // SSH → WebSocket
      stream.on('data', (data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'data', data: data.toString('base64') }));
        }
      });

      stream.stderr.on('data', (data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'data', data: data.toString('base64') }));
        }
      });

      stream.on('close', () => {
        ws.send(JSON.stringify({ type: 'status', message: 'disconnected' }));
        ws.close();
        conn.end();
      });

      // WebSocket → SSH
      ws.on('message', (msg) => {
        try {
          const parsed = JSON.parse(msg.toString());
          if (parsed.type === 'data') {
            stream.write(Buffer.from(parsed.data, 'base64'));
          } else if (parsed.type === 'resize') {
            stream.setWindow(parsed.rows || 24, parsed.cols || 80, 0, 0);
          }
        } catch (_) {
          // Raw text fallback
          stream.write(msg.toString());
        }
      });

      ws.on('close', () => {
        stream.close();
        conn.end();
      });

      ws.on('error', () => {
        stream.close();
        conn.end();
      });
    });
  });

  conn.on('error', (err) => {
    console.error('[SSH] Connection error:', err.message);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'error', message: `Erro SSH: ${err.message}` }));
      ws.close();
    }
  });

  conn.connect({
    host: session.host,
    port: parseInt(session.port, 10) || 22,
    username: session.username,
    password,
    readyTimeout: 30000,
    keepaliveInterval: 10000,
    algorithms: {
      serverHostKey: [
        'ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256',
        'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521',
        'rsa-sha2-512', 'rsa-sha2-256'
      ],
      kex: [
        'diffie-hellman-group1-sha1', 'diffie-hellman-group14-sha1',
        'diffie-hellman-group-exchange-sha1', 'diffie-hellman-group-exchange-sha256',
        'ecdh-sha2-nistp256', 'ecdh-sha2-nistp384', 'ecdh-sha2-nistp521',
        'curve25519-sha256', 'curve25519-sha256@libssh.org'
      ],
      cipher: [
        'aes128-ctr', 'aes192-ctr', 'aes256-ctr',
        'aes128-gcm@openssh.com', 'aes256-gcm@openssh.com',
        'aes128-cbc', 'aes192-cbc', 'aes256-cbc', '3des-cbc'
      ]
    },
    // Accept any host key (similar to ssh -o StrictHostKeyChecking=no)
    hostVerifier: () => true,
    debug: (msg) => console.log('[SSH DEBUG]', msg)
  });
}

// ─── Main server ─────────────────────────────────────────────────────────────
app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // ─── SSH WebSocket server ─────────────────────────────────────────────────
  const sshWss = new WebSocketServer({ noServer: true });
  sshWss.on('connection', (ws, req) => {
    const parsedUrl = parse(req.url, true);
    const sessionId = parsedUrl.query.sessionId;
    if (!sessionId) {
      ws.send(JSON.stringify({ type: 'error', message: 'sessionId ausente.' }));
      ws.close();
      return;
    }
    handleSshWebSocket(ws, sessionId);
  });

  server.on('upgrade', (req, socket, head) => {
    const parsedUrl = parse(req.url, true);

    if (parsedUrl.pathname === '/api/sshproxy') {
      // Validate JWT auth token
      const authToken = parsedUrl.query.authToken;
      if (!authToken) {
        console.error('[SSH] Missing authToken');
        socket.destroy();
        return;
      }
      try {
        const jwtSecret = process.env.JWT_SECRET || 'default_node_commander_secret';
        jwt.verify(authToken, jwtSecret);
      } catch (err) {
        console.error('[SSH] Invalid authToken:', err.message);
        socket.destroy();
        return;
      }
      sshWss.handleUpgrade(req, socket, head, (ws) => {
        sshWss.emit('connection', ws, req);
      });
    } else if (parsedUrl.pathname === '/api/vncproxy') {
      const targetUrl = parsedUrl.query.target;
      const ticket = parsedUrl.query.ticket;
      const proxyAuthToken = parsedUrl.query.proxyAuthToken;

      if (!targetUrl || !ticket || !proxyAuthToken) {
        console.error('Missing target, ticket, or auth token in VNC proxy request');
        socket.destroy();
        return;
      }

      try {
        const jwtSecret = process.env.JWT_SECRET || 'default_node_commander_secret';
        const decoded = jwt.verify(proxyAuthToken, jwtSecret);
        const authHeaders = decoded.authHeaders;
        if (authHeaders) {
          for (const key in authHeaders) {
            req.headers[key.toLowerCase()] = authHeaders[key];
          }
        }
      } catch (err) {
        console.error('Invalid proxyAuthToken', err);
        socket.destroy();
        return;
      }

      const target = new URL(targetUrl);
      console.log(`[VNC Proxy] Upgrading connection to ${targetUrl}`);
      proxy.ws(req, socket, head, {
        target: target.origin,
        ws: true,
        headers: { host: target.host },
        ignorePath: true,
      });
    } else {
      app.getUpgradeHandler()(req, socket, head);
    }
  });

  proxy.on('proxyReqWs', (proxyReq, req, socket, options, head) => {
    const parsedUrl = parse(req.url, true);
    if (parsedUrl.pathname === '/api/vncproxy') {
      const targetUrl = new URL(parsedUrl.query.target);
      proxyReq.path = targetUrl.pathname + targetUrl.search;
    }
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> VNC Proxy enabled on /api/vncproxy`);
    console.log(`> SSH Proxy enabled on /api/sshproxy`);
  });
});
