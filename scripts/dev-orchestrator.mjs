import net from "node:net";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const args = new Set(process.argv.slice(2));
const runFrontend = !args.has("--backend-only");
const runBackend = !args.has("--frontend-only");
const dryRun = args.has("--dry-run");

if (!runFrontend && !runBackend) {
  console.error("[dev] Seleccion invalida: usa --frontend-only o --backend-only.");
  process.exit(1);
}

const npmCommand = process.platform === "win32" ? "npm" : "npm";

function parsePort(rawValue, fallbackPort) {
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536
    ? parsed
    : fallbackPort;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const fileContent = fs.readFileSync(filePath, "utf8");
  const parsed = {};

  for (const rawLine of fileContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function canBindPort(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function isPortAvailable(port) {
  const ipv4Free = await canBindPort(port, "0.0.0.0");
  if (!ipv4Free) {
    return false;
  }

  const ipv6Free = await canBindPort(port, "::");
  return ipv6Free;
}

async function findAvailablePort(startPort, reservedPorts = new Set()) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (reservedPorts.has(port)) {
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No hay puertos libres desde ${startPort} hasta ${startPort + 99}`);
}

function wireProcessLogs(label, childProcess) {
  const stdoutReader = readline.createInterface({ input: childProcess.stdout });
  stdoutReader.on("line", (line) => {
    console.log(`[${label}] ${line}`);
  });

  const stderrReader = readline.createInterface({ input: childProcess.stderr });
  stderrReader.on("line", (line) => {
    console.error(`[${label}] ${line}`);
  });
}

function startProcess(label, command, extraEnv = {}) {
  const childProcess = spawn(command, {
    shell: true,
    stdio: ["inherit", "pipe", "pipe"],
    env: { ...process.env, ...extraEnv },
    cwd: process.cwd(),
  });

  wireProcessLogs(label, childProcess);
  return childProcess;
}

async function main() {
  const backendEnv = readEnvFile(path.resolve(process.cwd(), "backend/.env"));
  const frontendEnv = readEnvFile(path.resolve(process.cwd(), "frontend/.env.local"));

  const preferredFrontendPort = parsePort(
    process.env.FRONTEND_PORT ?? frontendEnv.FRONTEND_PORT ?? frontendEnv.PORT,
    3000,
  );
  const preferredBackendPort = parsePort(
    process.env.BACKEND_PORT ??
      process.env.PORT ??
      backendEnv.BACKEND_PORT ??
      backendEnv.PORT,
    3001,
  );

  const reserved = new Set();
  let frontendPort = preferredFrontendPort;
  let backendPort = preferredBackendPort;

  if (runFrontend) {
    frontendPort = await findAvailablePort(preferredFrontendPort, reserved);
    reserved.add(frontendPort);
  }

  if (runBackend) {
    backendPort = await findAvailablePort(preferredBackendPort, reserved);
    reserved.add(backendPort);
  }

  const corsOrigin =
    process.env.CORS_ORIGIN ??
    (runFrontend
      ? `http://localhost:${frontendPort}`
      : (backendEnv.CORS_ORIGIN ?? `http://localhost:${preferredFrontendPort}`));

  console.log(
    `[dev] Frontend port: ${runFrontend ? frontendPort : "disabled"} | Backend port: ${runBackend ? backendPort : "disabled"}`,
  );
  if (runBackend) {
    console.log(`[dev] Backend CORS origin: ${corsOrigin}`);
  }
  if (dryRun) {
    return;
  }

  const runningProcesses = [];
  let isShuttingDown = false;
  let firstExitCode = 0;

  function shutdown(exitCode = 0) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    firstExitCode = firstExitCode || exitCode;

    for (const childProcess of runningProcesses) {
      if (!childProcess.killed) {
        childProcess.kill();
      }
    }

    setTimeout(() => {
      process.exit(firstExitCode);
    }, 200);
  }

  if (runFrontend) {
    const frontendProcess = startProcess(
      "frontend",
      `${npmCommand} run dev -w frontend -- --port ${frontendPort}`,
    );
    runningProcesses.push(frontendProcess);
    frontendProcess.on("exit", (code) => {
      shutdown(code ?? 0);
    });
  }

  if (runBackend) {
    const backendProcess = startProcess(
      "backend",
      `${npmCommand} run start:dev -w backend`,
      {
        PORT: String(backendPort),
        CORS_ORIGIN: corsOrigin,
      },
    );
    runningProcesses.push(backendProcess);
    backendProcess.on("exit", (code) => {
      shutdown(code ?? 0);
    });
  }

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
}

main().catch((error) => {
  console.error("[dev] Error iniciando entorno:", error);
  process.exit(1);
});
