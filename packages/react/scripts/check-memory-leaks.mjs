import { createServer } from "node:http";
import { access, readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.AGENT_UI_MEMORY_PORT ?? 9333);
const storybookPort = Number(process.env.AGENT_UI_MEMORY_STORYBOOK_PORT ?? 6417);
const storybookRoot = new URL("../storybook-static/", import.meta.url).pathname;
const storyUrl = `http://127.0.0.1:${storybookPort}/iframe.html?id=agent-ui-stress-memory-leak--harness&viewMode=story`;

const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
};

async function resolveChromePath() {
  const candidates = process.env.CHROME_PATH
    ? [process.env.CHROME_PATH]
    : process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium"
        ]
      : process.platform === "win32"
        ? [
            join(process.env.PROGRAMFILES ?? "", "Google/Chrome/Application/chrome.exe"),
            join(process.env["PROGRAMFILES(X86)"] ?? "", "Google/Chrome/Application/chrome.exe"),
            join(process.env.LOCALAPPDATA ?? "", "Google/Chrome/Application/chrome.exe")
          ]
        : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next platform-specific location.
    }
  }
  throw new Error("Chrome was not found. Set CHROME_PATH to a Chrome or Chromium executable.");
}

function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url ?? "/", storyUrl).pathname);
      const relative = normalize(pathname).replace(/^[/\\]+/, "");
      const file = join(storybookRoot, relative || "index.html");
      if (!file.startsWith(storybookRoot)) throw new Error("Invalid path");
      const info = await stat(file);
      const resolved = info.isDirectory() ? join(file, "index.html") : file;
      response.writeHead(200, {
        "content-type": contentTypes[extname(resolved)] ?? "application/octet-stream"
      });
      response.end(await readFile(resolved));
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(storybookPort, "127.0.0.1", () => resolve(server));
  });
}

async function waitForPage() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const pages = await response.json();
      const page = pages.find((entry) => entry.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chrome DevTools endpoint did not start");
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? "Browser evaluation failed");
  }
  return result.result.value;
}

async function retainedCount(client, prototypeExpression) {
  const prototype = await client.send("Runtime.evaluate", { expression: prototypeExpression });
  const prototypeId = prototype.result.objectId;
  if (!prototypeId) throw new Error(`No prototype object for ${prototypeExpression}`);
  const objects = await client.send("Runtime.queryObjects", { prototypeObjectId: prototypeId });
  const count = await client.send("Runtime.callFunctionOn", {
    objectId: objects.objects.objectId,
    functionDeclaration: "function () { return this.length; }",
    returnByValue: true
  });
  await client.send("Runtime.releaseObject", { objectId: objects.objects.objectId });
  await client.send("Runtime.releaseObject", { objectId: prototypeId });
  return count.result.value;
}

async function collect(client, label) {
  await evaluate(client, "window.__agentUiMemoryHarness.clear().then(() => window.__agentUiMemoryHarness.clear())");
  // Multiple passes make the exact retained-object assertion robust against
  // transient stack/register and React scheduling references.
  for (let pass = 0; pass < 3; pass++) {
    await client.send("HeapProfiler.collectGarbage");
  }
  const [payloads, messages, heap, stats] = await Promise.all([
    retainedCount(client, "window.__agentUiMemoryHarness.payloadPrototype"),
    retainedCount(client, "window.__agentUiMemoryHarness.messagePrototype"),
    client.send("Runtime.getHeapUsage"),
    evaluate(client, "window.__agentUiMemoryHarness.stats()")
  ]);
  return {
    label,
    payloads,
    messages,
    usedHeapBytes: heap.usedSize,
    domNodes: stats.domNodes,
    mountedMessages: stats.mountedMessages,
    cycles: stats.cycles
  };
}

async function stopChrome(child) {
  if (!child || child.exitCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 2000))
  ]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}

let server;
let chrome;
let client;
let profile;

try {
  await stat(join(storybookRoot, "iframe.html"));
  server = await startStaticServer();
  profile = await mkdtemp(join(tmpdir(), "agent-ui-memory-"));
  const chromePath = await resolveChromePath();
  chrome = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--disable-background-networking",
    "--disable-extensions",
    "about:blank"
  ], { stdio: "ignore" });

  client = new CdpClient(await waitForPage());
  await client.connect();
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Page.navigate", { url: storyUrl });

  for (let attempt = 0; attempt < 200; attempt++) {
    const ready = await evaluate(client, "Boolean(window.__agentUiMemoryHarness)").catch(() => false);
    if (ready) break;
    if (attempt === 199) throw new Error("Memory harness did not become ready");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await evaluate(client, "window.__agentUiMemoryHarness.run(3)");
  const baseline = await collect(client, "warm baseline");

  // Positive control: prove the CDP object query can see live harness objects
  // before relying on a zero count after eviction.
  await evaluate(client, "window.__agentUiMemoryHarness.populate()");
  await client.send("HeapProfiler.collectGarbage");
  const livePayloads = await retainedCount(client, "window.__agentUiMemoryHarness.payloadPrototype");
  const liveMessages = await retainedCount(client, "window.__agentUiMemoryHarness.messagePrototype");
  if (livePayloads < 100 || liveMessages < 100) {
    throw new Error("Memory verification setup failed: live stress objects were not observable");
  }

  await evaluate(client, "window.__agentUiMemoryHarness.run(25)");
  const first = await collect(client, "after 25 cycles");
  await evaluate(client, "window.__agentUiMemoryHarness.run(25)");
  const second = await collect(client, "after 50 cycles");

  console.table([baseline, first, second]);

  const retained = [first, second].some((sample) =>
    sample.payloads !== 0 || sample.messages !== 0 || sample.mountedMessages !== 0
  );
  const domGrowth = [first, second].some((sample) => sample.domNodes > baseline.domNodes + 5);
  const maxHeapGrowth = Math.max(1_000_000, first.usedHeapBytes * 0.1);
  const heapGrowth = second.usedHeapBytes > first.usedHeapBytes + maxHeapGrowth;
  if (retained || domGrowth || heapGrowth) {
    throw new Error("Memory verification failed: retained objects, DOM nodes, or heap growth exceeded the bound");
  }
  console.log("Memory verification passed: evicted messages, payloads, and mounted transcript nodes were collected.");
} finally {
  client?.close();
  await stopChrome(chrome);
  server?.close();
  if (profile) await rm(profile, { recursive: true, force: true });
}
