#!/usr/bin/env node
/**
 * Dev-only proxy that adds COOP/COEP headers required by expo-sqlite on web.
 * Expo's HTML document is served without these headers; the JS bundle gets them from Metro.
 */
import http from 'node:http';

const LISTEN_PORT = Number(process.env.WEB_PROXY_PORT ?? 8081);
const TARGET_PORT = Number(process.env.EXPO_PORT ?? 8082);
const TARGET = `http://127.0.0.1:${TARGET_PORT}`;

function withIsolationHeaders(headers) {
  return {
    ...headers,
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };
}

function proxyHeaders(req) {
  return {
    ...req.headers,
    host: `127.0.0.1:${TARGET_PORT}`,
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', TARGET);

  const proxyReq = http.request(
    url,
    {
      method: req.method,
      headers: proxyHeaders(req),
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, withIsolationHeaders(proxyRes.headers));
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', (error) => {
    res.writeHead(502, withIsolationHeaders({ 'Content-Type': 'text/plain' }));
    res.end(`Dev proxy could not reach Expo on port ${TARGET_PORT}: ${error.message}`);
  });

  req.pipe(proxyReq);
});

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', TARGET);
  const proxyReq = http.request(
    url,
    {
      method: req.method,
      headers: proxyHeaders(req),
    },
  );

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      `HTTP/1.1 ${proxyRes.statusCode ?? 101} ${proxyRes.statusMessage ?? 'Switching Protocols'}\r\n` +
        Object.entries(withIsolationHeaders(proxyRes.headers))
          .map(([key, value]) => `${key}: ${value}`)
          .join('\r\n') +
        '\r\n\r\n',
    );
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
    proxySocket.write(proxyHead);
    socket.write(head);
  });

  proxyReq.on('error', () => socket.destroy());
  proxyReq.end();
});

server.listen(LISTEN_PORT, () => {
  console.log(`Web dev proxy: http://localhost:${LISTEN_PORT} -> ${TARGET}`);
});
