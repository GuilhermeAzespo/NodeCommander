const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const httpProxy = require('http-proxy');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const proxy = httpProxy.createProxyServer({
  ws: true,
  secure: false, // Proxmox typically uses self-signed certificates
});

proxy.on('error', (err, req, res) => {
  console.error('Proxy Error:', err);
  if (res && res.writeHead) {
    res.writeHead(500, {
      'Content-Type': 'text/plain',
    });
    res.end('Proxy Error');
  }
});

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

  server.on('upgrade', (req, socket, head) => {
    const parsedUrl = parse(req.url, true);
    
    if (parsedUrl.pathname === '/api/vncproxy') {
      const targetUrl = parsedUrl.query.target;
      const ticket = parsedUrl.query.ticket;
      
      if (!targetUrl || !ticket) {
        console.error('Missing target or ticket in VNC proxy request');
        socket.destroy();
        return;
      }

      // Proxmox requires the PVEAuthCookie to authenticate the websocket
      req.headers['cookie'] = `PVEAuthCookie=${ticket}`;
      
      // Parse the target URL to ensure we pass the correct host header
      const target = new URL(targetUrl);
      
      console.log(`[VNC Proxy] Upgrading connection to ${targetUrl}`);
      
      proxy.ws(req, socket, head, {
        target: target.origin,
        ws: true,
        headers: {
          host: target.host,
        },
        ignorePath: true, // We will manually rewrite the URL in the proxyReqWs event
      });
    } else {
      // Pass other upgrade requests (like Next.js HMR in dev) to Next
      app.getUpgradeHandler()(req, socket, head);
    }
  });

  // Rewrite the path correctly for the WebSocket
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
  });
});
