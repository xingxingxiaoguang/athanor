#!/usr/bin/env node
import { createServer } from "node:http";
import { readFileSync, realpathSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { LAB, RECORDS, history } from "./lab.mjs";
import { TOOLS } from "./definitions.mjs";
import { invoke } from "./invoke.mjs";
import { errorResult } from "./errors.mjs";
import { recordCall } from './journal.mjs';

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".json": "application/json", ".mp4": "video/mp4", ".gif": "image/gif" };
export function createLabServer() {
  return createServer(async (req, res) => {
    const reply = (status, data) => res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(data));
    try {
      const port = req.socket.localPort, hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
      if (!hosts.includes(req.headers.host)) return reply(403, { error: "Local host only" });
      if (req.headers.origin && !hosts.map((h) => `http://${h}`).includes(req.headers.origin)) return reply(403, { error: "Same-origin requests only" });
      const requestUrl = new URL(req.url, 'http://localhost'), path = decodeURIComponent(requestUrl.pathname);
      if (req.method === "GET" && path === "/api/tools") {
        try { return reply(200, requestUrl.search
          ? await invoke('tools', Object.fromEntries(requestUrl.searchParams))
          : await recordCall('tools', { detail: 'full' }, () => TOOLS)); }
        catch (error) { return reply(400, { ok: false, error: error.message, diagnostic: errorResult(error) }); }
      }
      if (req.method === "GET" && path === "/api/runs") return reply(200, history());
      if (req.method === "POST" && path === "/api/call") {
        if (req.headers["content-type"]?.split(";")[0] !== "application/json") return reply(415, { error: "Use application/json" });
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 65536) return reply(413, { error: "Input exceeds 64 KB" });
        }
        const { name, arguments: args } = JSON.parse(body);
        try { return reply(200, { ok: true, result: await invoke(name, args) }); }
        catch (error) { return reply(400, { ok: false, error: error.message, diagnostic: errorResult(error) }); }
      }
      if (req.method !== "GET") return reply(405, { error: "Method not allowed" });
      let base, filename;
      if (path.startsWith("/artifacts/")) { base = RECORDS; filename = resolve(base, path.slice(11)); }
      else if (["/", "/index.html", "/app.js", "/style.css"].includes(path)) { base = LAB; filename = join(base, path === "/" ? "index.html" : path.slice(1)); }
      else return reply(404, { error: "Not found" });
      const file = realpathSync(filename);
      if (!file.startsWith(base + sep) || !TYPES[extname(file)]) return reply(403, { error: "File not served" });
      res.writeHead(200, { "content-type": TYPES[extname(file)], "cache-control": "no-store", "x-content-type-options": "nosniff" }).end(readFileSync(file));
    } catch (error) { reply(error instanceof SyntaxError || error instanceof URIError ? 400 : 404, { error: error.message }); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.argv[2] ?? 4173);
  createLabServer().listen(port, "127.0.0.1", () => console.log(`VFX Lab: http://127.0.0.1:${port}`));
}
