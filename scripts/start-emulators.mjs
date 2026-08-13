#!/usr/bin/env node
/**
 * Starts the local Firebase emulators (auth + firestore) without tripping over
 * an already-running instance.
 *
 * The previous `firebase emulators:start` would fail with "Could not start
 * Emulator UI, port taken" whenever the ports were already occupied — usually
 * because an emulator from an earlier session was still running. This script:
 *
 *   1. Probes the configured emulator ports. If the firestore/auth emulators
 *      are already alive, it prints the running URLs and exits 0 (reuse).
 *   2. Otherwise it kills whatever is squatting on the emulator ports (stale
 *      leftover processes) and starts a fresh instance.
 *
 * Run with: npm run emulators
 */
import { spawn } from "node:child_process";
import net from "node:net";
import { readFileSync } from "node:fs";

const projectRoot = new URL("..", import.meta.url).pathname;
const firebaseJson = JSON.parse(
  readFileSync(`${projectRoot}firebase.json`, "utf8")
);

const emulators = firebaseJson.emulators;
const authPort = emulators.auth?.port ?? 9099;
const firestorePort = emulators.firestore?.port ?? 8080;
const uiPort = emulators.ui?.port ?? 4000;
const uiHost = emulators.ui?.host ?? "127.0.0.1";
const host = emulators.auth?.host ?? "127.0.0.1";

const checkPort = (port) =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(700);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("error", () => resolve(false));
    socket.connect(port, host);
  });

function killOnPort(port) {
  return new Promise((resolve) => {
    const proc = spawn("lsof", ["-tiTCP:" + port, "-sTCP:LISTEN"]);
    let out = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.on("close", () => {
      const pids = out
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (pids.length === 0) return resolve();
      // -9 ignores any in-flight emulator shutdown that lsof races with.
      const killer = spawn("kill", ["-9", ...pids]);
      killer.on("close", () => {
        console.log(`  freed port ${port} (PID ${pids.join(", ")})`);
        resolve();
      });
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (port, label, timeoutMs) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkPort(port)) return true;
    await sleep(400);
  }
  console.error(`  ✗ ${label} (port ${port}) did not come up in time`);
  return false;
};

console.log("Padhle emulators — checking existing instances…");

const [authUp, firestoreUp] = await Promise.all([
  checkPort(authPort),
  checkPort(firestorePort),
]);

if (authUp && firestoreUp) {
  console.log("Emulators are already running. Reusing them:");
  console.log(`  Auth:       http://${host}:${authPort}`);
  console.log(`  Firestore:  http://${host}:${firestorePort}`);
  if (emulators.ui?.enabled !== false) {
    console.log(`  Emulator UI: http://${uiHost}:${uiPort}`);
  }
  process.exit(0);
}

if (authUp || firestoreUp) {
  console.error("Emulators are in a half-started state. Restarting cleanly…");
}
await killOnPort(authPort);
await killOnPort(firestorePort);
if (emulators.ui?.enabled !== false) await killOnPort(uiPort);
await sleep(400);

console.log("Starting emulators (auth + firestore)…");
const child = spawn(
  "npx",
  [
    "firebase",
    "emulators:start",
    "--only",
    "auth,firestore",
    "--project",
    "padhle",
  ],
  { stdio: "inherit", cwd: projectRoot, env: process.env }
);

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
child.on("error", (err) => {
  console.error("Failed to start firebase emulators:", err);
  process.exit(1);
});
