#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const expoPort = process.env.EXPO_PORT ?? '8082';
const proxyPort = process.env.WEB_PROXY_PORT ?? '8081';
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proxyScript = path.join(rootDir, 'scripts/web-proxy.mjs');

const expo = spawn(
  'npx',
  ['expo', 'start', '--web', '--port', expoPort, '--clear'],
  {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, EXPO_PORT: expoPort, WEB_PROXY_PORT: proxyPort },
  },
);

const proxy = spawn(process.execPath, [proxyScript], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, EXPO_PORT: expoPort, WEB_PROXY_PORT: proxyPort },
});

function shutdown(code = 0) {
  expo.kill('SIGTERM');
  proxy.kill('SIGTERM');
  process.exit(code);
}

expo.on('exit', (code) => shutdown(code ?? 0));
proxy.on('exit', (code) => {
  if (code && code !== 0) {
    shutdown(code);
  }
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`Starting web dev: open http://localhost:${proxyPort} (proxy -> Expo ${expoPort})`);
