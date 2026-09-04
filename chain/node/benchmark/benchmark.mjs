import os from 'node:os';
import { readFile, writeFile, statfs } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const role = String(process.env.NODE_ROLE || 'lite').trim().toLowerCase();
const endpoint = String(process.env.NODE_ENDPOINT || (role === 'lite' ? 'http://127.0.0.1:18100' : 'http://127.0.0.1:19944')).trim();
const durationSeconds = intEnv('DURATION_SECONDS', 300, 10, 604800);
const intervalMs = intEnv('INTERVAL_MS', 5000, 1000, 60000);
const output = String(process.env.OUTPUT || `swappulse-node-benchmark-${role}-${Date.now()}.json`).trim();
const diskPath = String(process.env.DISK_PATH || '/').trim();
const containerName = String(process.env.CONTAINER_NAME || '').trim();

if (!['lite', 'full'].includes(role)) throw new Error('NODE_ROLE must be lite or full');

function intEnv(name, fallback, min, max) {
  const n = Number.parseInt(String(process.env[name] || ''), 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  const started = performance.now();
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    const latency_ms = Math.round((performance.now() - started) * 10) / 10;
    let data = null;
    try { data = JSON.parse(text); } catch {}
    return { ok: response.ok, status: response.status, latency_ms, data };
  } catch (error) {
    return { ok: false, status: 0, latency_ms: Math.round((performance.now() - started) * 10) / 10, error: String(error?.message || error), data: null };
  } finally {
    clearTimeout(timer);
  }
}

async function rpc(method, params = []) {
  return fetchJson(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
}

async function liteProbe() {
  const base = endpoint.replace(/\/$/, '');
  const [status, rpcChain] = await Promise.all([
    fetchJson(`${base}/status`),
    fetchJson(`${base}/rpc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'starknet_chainId', params: [] }),
    }),
  ]);
  return {
    status_http: status.status,
    status_latency_ms: status.latency_ms,
    ready: Boolean(status.data?.ready),
    trust_mode: status.data?.trust_mode || '',
    independent: Boolean(status.data?.independently_verified),
    pins_verified: Boolean(status.data?.pins_verified),
    healthy_peers: Number(status.data?.healthy_peer_count || 0),
    common_height: status.data?.common_height ?? null,
    common_block_hash: status.data?.common_block_hash ?? null,
    rpc_http: rpcChain.status,
    rpc_latency_ms: rpcChain.latency_ms,
  };
}

async function fullProbe() {
  const [syncing, block, chain] = await Promise.all([
    rpc('starknet_syncing', []),
    rpc('starknet_blockNumber', []),
    rpc('starknet_chainId', []),
  ]);
  return {
    syncing_http: syncing.status,
    syncing_latency_ms: syncing.latency_ms,
    syncing: syncing.data?.result ?? null,
    block_http: block.status,
    block_latency_ms: block.latency_ms,
    block_number: block.data?.result ?? null,
    chain_http: chain.status,
    chain_latency_ms: chain.latency_ms,
    chain_id: chain.data?.result ?? null,
  };
}

async function memInfo() {
  try {
    const raw = await readFile('/proc/meminfo', 'utf8');
    const rows = Object.fromEntries(raw.split('\n').filter(Boolean).map((line) => {
      const [key, rest] = line.split(':');
      const value = Number.parseInt(String(rest || '').trim(), 10);
      return [key, Number.isFinite(value) ? value * 1024 : 0];
    }));
    return {
      mem_available_bytes: rows.MemAvailable ?? null,
      swap_total_bytes: rows.SwapTotal ?? null,
      swap_free_bytes: rows.SwapFree ?? null,
      swap_cached_bytes: rows.SwapCached ?? null,
    };
  } catch {
    return { mem_available_bytes: os.freemem(), swap_total_bytes: null, swap_free_bytes: null, swap_cached_bytes: null };
  }
}

async function cpuTemp() {
  const candidates = [
    '/sys/class/thermal/thermal_zone0/temp',
    '/sys/class/hwmon/hwmon0/temp1_input',
    '/sys/class/hwmon/hwmon1/temp1_input',
    '/sys/class/hwmon/hwmon2/temp1_input',
  ];
  for (const file of candidates) {
    try {
      const raw = Number.parseFloat((await readFile(file, 'utf8')).trim());
      if (!Number.isFinite(raw)) continue;
      const c = raw > 1000 ? raw / 1000 : raw;
      if (c > 1 && c < 130) return Math.round(c * 10) / 10;
    } catch {}
  }
  return null;
}

async function diskInfo() {
  try {
    const s = await statfs(diskPath);
    return {
      disk_path: diskPath,
      disk_total_bytes: Number(s.blocks) * Number(s.bsize),
      disk_free_bytes: Number(s.bavail) * Number(s.bsize),
    };
  } catch {
    return { disk_path: diskPath, disk_total_bytes: null, disk_free_bytes: null };
  }
}

function parsePsiLine(line) {
  const parts = String(line || '').trim().split(/\s+/);
  if (!parts.length) return null;
  const row = { scope: parts[0] };
  for (const part of parts.slice(1)) {
    const [key, value] = part.split('=');
    if (!key) continue;
    const parsed = Number(value);
    row[key] = Number.isFinite(parsed) ? parsed : value;
  }
  return row;
}

async function pressureInfo() {
  const out = {};
  for (const resource of ['cpu', 'memory', 'io']) {
    try {
      const raw = await readFile(`/proc/pressure/${resource}`, 'utf8');
      const rows = raw.trim().split('\n').map(parsePsiLine).filter(Boolean);
      const some = rows.find((r) => r.scope === 'some') || {};
      const full = rows.find((r) => r.scope === 'full') || {};
      out[`psi_${resource}_some_avg10`] = Number.isFinite(some.avg10) ? some.avg10 : null;
      out[`psi_${resource}_full_avg10`] = Number.isFinite(full.avg10) ? full.avg10 : null;
    } catch {
      out[`psi_${resource}_some_avg10`] = null;
      out[`psi_${resource}_full_avg10`] = null;
    }
  }
  return out;
}

function humanBytes(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^([0-9.]+)\s*([KMGTPE]?i?B)$/i);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  const unit = match[2].toUpperCase();
  const powers = {
    B: 0,
    KB: 1,
    KIB: 1,
    MB: 2,
    MIB: 2,
    GB: 3,
    GIB: 3,
    TB: 4,
    TIB: 4,
    PB: 5,
    PIB: 5,
    EB: 6,
    EIB: 6,
  };
  const power = powers[unit];
  if (power === undefined) return null;
  const base = unit.includes('IB') ? 1024 : 1000;
  return Math.round(n * (base ** power));
}

function parsePair(value) {
  const [left, right] = String(value || '').split('/').map((v) => v.trim());
  return [humanBytes(left), humanBytes(right)];
}

async function dockerContainerStats() {
  if (!containerName) return null;
  try {
    const { stdout } = await execFileAsync('docker', [
      'stats', '--no-stream', '--format', '{{json .}}', containerName,
    ], { timeout: 10_000, maxBuffer: 256 * 1024 });
    const line = stdout.trim().split('\n').filter(Boolean)[0];
    if (!line) return { available: false, error: 'NO_DOCKER_STATS' };
    const row = JSON.parse(line);
    const cpu = Number.parseFloat(String(row.CPUPerc || '').replace('%', ''));
    const [memUsage, memLimit] = parsePair(row.MemUsage);
    const [netRx, netTx] = parsePair(row.NetIO);
    const [blockRead, blockWrite] = parsePair(row.BlockIO);
    const pids = Number.parseInt(String(row.PIDs || ''), 10);
    return {
      available: true,
      name: row.Name || containerName,
      cpu_percent: Number.isFinite(cpu) ? cpu : null,
      memory_usage_bytes: memUsage,
      memory_limit_bytes: memLimit,
      network_rx_bytes: netRx,
      network_tx_bytes: netTx,
      block_read_bytes: blockRead,
      block_write_bytes: blockWrite,
      pids: Number.isFinite(pids) ? pids : null,
    };
  } catch (error) {
    return { available: false, error: String(error?.message || error) };
  }
}

function cpuTimes() {
  return os.cpus().map((cpu) => ({ ...cpu.times }));
}

function cpuDelta(before, after) {
  let busy = 0;
  let total = 0;
  for (let i = 0; i < Math.min(before.length, after.length); i++) {
    const b = before[i];
    const a = after[i];
    const fields = ['user', 'nice', 'sys', 'idle', 'irq'];
    const deltas = Object.fromEntries(fields.map((k) => [k, Math.max(0, a[k] - b[k])]));
    const t = fields.reduce((sum, k) => sum + deltas[k], 0);
    total += t;
    busy += t - deltas.idle;
  }
  return total > 0 ? Math.round((busy / total) * 1000) / 10 : 0;
}

const report = {
  schema_version: 2,
  role,
  endpoint,
  container_name: containerName || null,
  started_at: new Date().toISOString(),
  requested_duration_seconds: durationSeconds,
  interval_ms: intervalMs,
  host: {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpu_model: os.cpus()?.[0]?.model || '',
    cpu_count: os.cpus().length,
    total_memory_bytes: os.totalmem(),
  },
  samples: [],
};

const start = Date.now();
let previousCpu = cpuTimes();
while (Date.now() - start < durationSeconds * 1000) {
  const sampleStarted = Date.now();
  const [probe, mem, temp, disk, pressure, container] = await Promise.all([
    role === 'lite' ? liteProbe() : fullProbe(),
    memInfo(),
    cpuTemp(),
    diskInfo(),
    pressureInfo(),
    dockerContainerStats(),
  ]);
  const currentCpu = cpuTimes();
  report.samples.push({
    at: new Date().toISOString(),
    uptime_seconds: os.uptime(),
    load_1m: os.loadavg()[0],
    load_5m: os.loadavg()[1],
    load_15m: os.loadavg()[2],
    host_cpu_busy_percent: cpuDelta(previousCpu, currentCpu),
    benchmark_process_rss_bytes: process.memoryUsage().rss,
    cpu_temperature_c: temp,
    ...mem,
    ...disk,
    ...pressure,
    container,
    probe,
  });
  previousCpu = currentCpu;
  const remaining = intervalMs - (Date.now() - sampleStarted);
  if (remaining > 0) await sleep(remaining);
}

report.finished_at = new Date().toISOString();
report.actual_duration_seconds = Math.round((Date.now() - start) / 1000);

const finite = (values) => values.filter((v) => typeof v === 'number' && Number.isFinite(v));
const max = (values) => values.length ? Math.max(...values) : null;
const min = (values) => values.length ? Math.min(...values) : null;
const avg = (values) => values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : null;

const hostCpu = finite(report.samples.map((s) => s.host_cpu_busy_percent));
const memAvail = finite(report.samples.map((s) => s.mem_available_bytes));
const swapFree = finite(report.samples.map((s) => s.swap_free_bytes));
const temp = finite(report.samples.map((s) => s.cpu_temperature_c));
const latency = finite(report.samples.map((s) => role === 'lite' ? s.probe.status_latency_ms : s.probe.block_latency_ms));
const failures = report.samples.filter((s) => role === 'lite' ? !s.probe.ready : s.probe.block_http !== 200).length;
const containerCpu = finite(report.samples.map((s) => s.container?.cpu_percent));
const containerMem = finite(report.samples.map((s) => s.container?.memory_usage_bytes));
const psiMem = finite(report.samples.map((s) => s.psi_memory_some_avg10));
const psiIo = finite(report.samples.map((s) => s.psi_io_some_avg10));

const firstContainer = report.samples.find((s) => s.container?.available)?.container || null;
const lastContainer = [...report.samples].reverse().find((s) => s.container?.available)?.container || null;

report.summary = {
  samples: report.samples.length,
  failed_samples: failures,
  availability_percent: report.samples.length ? Math.round(((report.samples.length - failures) / report.samples.length) * 10000) / 100 : 0,
  host_cpu_busy_percent_avg: avg(hostCpu),
  host_cpu_busy_percent_max: max(hostCpu),
  mem_available_bytes_min: min(memAvail),
  swap_free_bytes_min: min(swapFree),
  cpu_temperature_c_max: max(temp),
  rpc_latency_ms_avg: avg(latency),
  rpc_latency_ms_max: max(latency),
  container_cpu_percent_avg: avg(containerCpu),
  container_cpu_percent_max: max(containerCpu),
  container_memory_usage_bytes_avg: avg(containerMem),
  container_memory_usage_bytes_max: max(containerMem),
  container_network_rx_delta_bytes: firstContainer && lastContainer && firstContainer.network_rx_bytes != null && lastContainer.network_rx_bytes != null ? Math.max(0, lastContainer.network_rx_bytes - firstContainer.network_rx_bytes) : null,
  container_network_tx_delta_bytes: firstContainer && lastContainer && firstContainer.network_tx_bytes != null && lastContainer.network_tx_bytes != null ? Math.max(0, lastContainer.network_tx_bytes - firstContainer.network_tx_bytes) : null,
  container_block_read_delta_bytes: firstContainer && lastContainer && firstContainer.block_read_bytes != null && lastContainer.block_read_bytes != null ? Math.max(0, lastContainer.block_read_bytes - firstContainer.block_read_bytes) : null,
  container_block_write_delta_bytes: firstContainer && lastContainer && firstContainer.block_write_bytes != null && lastContainer.block_write_bytes != null ? Math.max(0, lastContainer.block_write_bytes - firstContainer.block_write_bytes) : null,
  psi_memory_some_avg10_max: max(psiMem),
  psi_io_some_avg10_max: max(psiIo),
};

await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o644 });
console.log(JSON.stringify({ ok: true, output, summary: report.summary }, null, 2));
