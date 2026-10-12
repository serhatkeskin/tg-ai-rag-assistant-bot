#!/usr/bin/env node
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import readline from "node:readline";

const CONFIG = {
  defaultPort: 3000,
  bin: "next",
  args: ["dev"],
  env: {},
};

function parseArgs() {
  const userArgs = process.argv.slice(2);
  let requestedPort = null;

  for (let i = 0; i < userArgs.length; i++) {
    const arg = userArgs[i];
    if (arg === "--port" || arg === "-p") {
      if (userArgs[i + 1]) requestedPort = parseInt(userArgs[i + 1], 10);
    } else if (arg.startsWith("--port=")) {
      requestedPort = parseInt(arg.split("=")[1], 10);
    }
  }

  return {
    targetPort: requestedPort || CONFIG.defaultPort,
    userArgs,
  };
}

function getPidsOnPort(port) {
  try {
    const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (out) return [...new Set(out.split("\n").map((p) => p.trim()).filter(Boolean))];
  } catch {}

  try {
    const out = execSync(`lsof -ti tcp:${port}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    if (out) return [...new Set(out.split("\n").map((p) => p.trim()).filter(Boolean))];
  } catch {}

  return [];
}

function getProcessDetails(pid) {
  try {
    const comm = execSync(`ps -p ${pid} -o comm=`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    const args = execSync(`ps -p ${pid} -o args=`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
    return { comm, args };
  } catch {
    return { comm: "unknown", args: "unknown" };
  }
}

function checkPortFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => {
      s.close(() => resolve(true));
    });
    s.listen(port);
  });
}

async function findNextFreePort(startPort) {
  let port = Number(startPort) + 1;
  while (port < Number(startPort) + 100) {
    if (getPidsOnPort(port).length === 0 && (await checkPortFree(port))) {
      return port;
    }
    port++;
  }
  return port;
}

async function killProcesses(pids, port) {
  console.log(`\n\x1b[33m[dev-runner]\x1b[0m Stopping process(es) on port ${port} (PID: ${pids.join(", ")})...`);
  for (const pid of pids) {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {}
  }

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 100));
    if (getPidsOnPort(port).length === 0 && (await checkPortFree(port))) {
      console.log(`\x1b[32m[dev-runner]\x1b[0m ✓ Port ${port} is now free.\n`);
      return true;
    }
  }

  const remaining = getPidsOnPort(port);
  if (remaining.length > 0) {
    console.log(`\x1b[33m[dev-runner]\x1b[0m Force terminating PID(s): ${remaining.join(", ")}...`);
    for (const pid of remaining) {
      try {
        process.kill(Number(pid), "SIGKILL");
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  const isFree = getPidsOnPort(port).length === 0 && (await checkPortFree(port));
  if (isFree) {
    console.log(`\x1b[32m[dev-runner]\x1b[0m ✓ Port ${port} is now free.\n`);
  }
  return isFree;
}

function promptUser(question) {
  if (process.env.DEV_PORT_CHOICE) {
    return Promise.resolve(process.env.DEV_PORT_CHOICE);
  }

  return new Promise((resolve) => {
    let resolved = false;
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      resolved = true;
      rl.close();
      resolve(answer.trim());
    });
    rl.on("close", () => {
      if (!resolved) {
        resolved = true;
        resolve("3");
      }
    });
  });
}

function resolveBin(binName) {
  const localBin = path.resolve(process.cwd(), "node_modules/.bin", binName);
  if (fs.existsSync(localBin)) {
    return localBin;
  }
  return binName;
}

function startServer(port, userArgs) {
  const executable = resolveBin(CONFIG.bin);
  const combinedArgs = [...CONFIG.args, ...userArgs];

  const hasPortArg = combinedArgs.some((a) => a === "--port" || a === "-p" || a.startsWith("--port="));
  if (!hasPortArg) {
    if (CONFIG.bin === "next") {
      combinedArgs.push("-p", String(port));
    } else {
      combinedArgs.push("--port", String(port));
    }
  } else {
    for (let i = 0; i < combinedArgs.length; i++) {
      if (combinedArgs[i] === "--port" || combinedArgs[i] === "-p") {
        combinedArgs[i + 1] = String(port);
        break;
      } else if (combinedArgs[i].startsWith("--port=")) {
        combinedArgs[i] = `--port=${port}`;
        break;
      }
    }
  }

  console.log(`\x1b[36m[dev-runner]\x1b[0m Launching ${CONFIG.bin} on port ${port}...`);

  const child = spawn(executable, combinedArgs, {
    stdio: "inherit",
    env: { ...process.env, ...CONFIG.env, PORT: String(port) },
  });

  const forwardSignal = (sig) => {
    try {
      child.kill(sig);
    } catch {}
  };

  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));
  process.on("SIGHUP", () => forwardSignal("SIGHUP"));

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 0);
    }
  });

  child.on("error", (err) => {
    console.error(`\x1b[31m[dev-runner]\x1b[0m Failed to spawn server:`, err.message);
    process.exit(1);
  });
}

async function main() {
  const { targetPort, userArgs } = parseArgs();
  const pids = getPidsOnPort(targetPort);

  if (pids.length === 0) {
    startServer(targetPort, userArgs);
    return;
  }

  const nextPort = await findNextFreePort(targetPort);
  const procInfos = pids.map((pid) => ({ pid, ...getProcessDetails(pid) }));

  console.log("\n\x1b[33m────────────────────────────────────────────────────────────\x1b[0m");
  console.log(`\x1b[33m[dev-runner] ⚠️  Port ${targetPort} is currently in use!\x1b[0m`);
  for (const info of procInfos) {
    console.log(`  • PID: \x1b[1m${info.pid}\x1b[0m (${info.comm})`);
    if (info.args && info.args !== info.comm) {
      const truncated = info.args.length > 70 ? info.args.slice(0, 67) + "..." : info.args;
      console.log(`    Command: ${truncated}`);
    }
  }
  console.log("\x1b[33m────────────────────────────────────────────────────────────\x1b[0m");

  console.log("\nWhat would you like to do?");
  console.log(`  \x1b[32m[1]\x1b[0m Kill process (${pids.join(", ")}) and start on port \x1b[1m${targetPort}\x1b[0m (default)`);
  console.log(`  \x1b[36m[2]\x1b[0m Start on next available port (\x1b[1m${nextPort}\x1b[0m)`);
  console.log(`  \x1b[90m[3]\x1b[0m Cancel\n`);

  const answer = await promptUser(`Select an option [1/2/3] (default: 1): `);

  if (answer === "" || answer === "1") {
    const success = await killProcesses(pids, targetPort);
    if (!success) {
      console.error(`\x1b[31m[dev-runner] Could not free port ${targetPort}. Aborting.\x1b[0m`);
      process.exit(1);
    }
    startServer(targetPort, userArgs);
  } else if (answer === "2") {
    startServer(nextPort, userArgs);
  } else {
    console.log("\x1b[90m[dev-runner] Operation cancelled.\x1b[0m");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("\x1b[31m[dev-runner] Unexpected error:\x1b[0m", err);
  process.exit(1);
});
