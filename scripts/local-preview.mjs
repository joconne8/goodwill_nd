// Non-Replit Linux fresh-clone launcher. Replit uses its managed artifact proxy.
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";

if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL in .env before starting.");
const base = Number(process.env.LOCAL_PREVIEW_PORT || 3000);
if (!Number.isInteger(base) || base < 1024 || base > 65000) throw new Error("Invalid LOCAL_PREVIEW_PORT");
const children = [];
let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  server.close();
  setTimeout(() => process.exit(code), 300).unref();
};
const server = http.createServer((req, res) => {
  const api = req.url === "/api" || req.url?.startsWith("/api/");
  const upstream = http.request({
    hostname: "127.0.0.1", port: base + (api ? 1 : 2),
    path: req.url, method: req.method, headers: req.headers,
  }, response => {
    res.writeHead(response.statusCode || 502, response.headers);
    response.pipe(res);
  });
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(503, { "content-type": "text/plain" });
    res.end("Service not ready. Check the API and frontend process logs.");
  });
  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
});
server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(base + 2, "127.0.0.1", () => {
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
      req.rawHeaders.reduce((s, v, i, a) => i % 2 ? s : s + `${v}: ${a[i + 1]}\r\n`, "") + "\r\n");
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
  socket.on("close", () => upstream.destroy());
});
server.on("error", error => { console.error(error.message); stop(1); });
server.listen(base, "127.0.0.1", () => {
  for (const [name, port] of [["api-server", base + 1], ["goodwill", base + 2]]) {
    const child = spawn("pnpm", ["--filter", `@workspace/${name}`, "run", "dev"], {
      stdio: "inherit", env: { ...process.env, PORT: String(port), BASE_PATH: "/" },
    });
    children.push(child);
    child.on("error", error => { console.error(error.message); stop(1); });
    child.on("exit", code => { if (!stopping) stop(code || 1); });
  }
  console.log(`Local preview: http://127.0.0.1:${base} (synthetic demo only)`);
});
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());