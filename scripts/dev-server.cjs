const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 8765);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};
// Deliberately serve only the app. Git history, local files, and contributor docs
// are outside this allowlist even when the server runs in the repository root.
const allowed = new Set([
  "/index.html",
  "/src/engine.js",
  "/src/app.js",
  "/src/style.css",
  "/src/sim/config.js",
  "/src/sim/random.js",
  "/src/sim/decision.js",
  "/src/sim/social.js",
  "/src/ui/map.js",
  "/src/ui/views.js",
]);
const server = http.createServer(async (request, response) => {
  let pathname;
  try {
    pathname = new URL(request.url, "http://localhost").pathname;
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (pathname === "/") pathname = "/index.html";
  if (!allowed.has(pathname)) {
    response.writeHead(404).end("Not found");
    return;
  }
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  try {
    const data = await fs.readFile(path.join(root, pathname));
    response.writeHead(200, {
      "Content-Type": types[path.extname(pathname)],
      "Cache-Control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : data);
  } catch {
    response.writeHead(500).end("Unable to read application file");
  }
});
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is busy. Try PORT=8766 npm run dev.`
      : error.message,
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () =>
  console.log(`VirtualCampus: http://127.0.0.1:${port}`),
);
