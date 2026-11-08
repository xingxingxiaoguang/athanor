#!/usr/bin/env node
// Minimal local stdio MCP adapter. No network service or model credentials.
import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { TOOLS } from "./definitions.mjs";
import { invoke } from "./invoke.mjs";
import { errorResult } from "./errors.mjs";
import { recordCall } from './journal.mjs';

let initialized = false, ready = false;
const send = (value) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...value }) + "\n");
const versions = ["2025-11-25", "2025-06-18"];

for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  let request;
  try { request = JSON.parse(line); }
  catch { send({ id: null, error: { code: -32700, message: "Invalid JSON" } }); continue; }
  if (!request || request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    send({ id: request?.id ?? null, error: { code: -32600, message: "Invalid JSON-RPC request" } }); continue;
  }
  if (request.id === undefined) {
    if (request.method === "notifications/initialized" && initialized) ready = true;
    continue;
  }
  const { id, method, params = {} } = request;
  if (method === "initialize") {
    initialized = true;
    send({ id, result: { protocolVersion: versions.includes(params.protocolVersion) ? params.protocolVersion : versions[0], capabilities: { tools: {} }, serverInfo: { name: "athanor-vfx-lab", version: "0.6.0" }, instructions: "Use fx_inspect ref:{kind:'tool',id:'catalog'} for a short directory or id:'fx_probe' (etc.) for its exact schema. fx_search also finds library mechanisms with contracts, reference fragments and dependencies; these differ from SDK core/* operators. Edit ordinary JavaScript. Render, LOOK at original-scale images and compare. Validate and export the same explicitly selected run; history recovers calls/errors. Validation does not grant aesthetic approval." } });
  } else if (method === "ping") send({ id, result: {} });
  else if (!ready) send({ id, error: { code: -32000, message: "Initialize and send notifications/initialized first" } });
  else if (method === "tools/list") send({ id, result: { tools: await recordCall('tools', {}, () => TOOLS) } });
  else if (method === "tools/call") {
    try {
      const result = await invoke(params.name, params.arguments ?? {});
      const content = [{ type: "text", text: JSON.stringify(result) }];
      const images = result.pages?.map(p => p.image) ?? (result.image ? [result.image] : []);
      for (const path of images) content.push({ type: "image", mimeType: "image/png", data: readFileSync(path).toString("base64") });
      send({ id, result: { content, structuredContent: result, isError: false } });
    } catch (error) {
      const diagnostic = errorResult(error);
      send({ id, result: { content: [{ type: "text", text: JSON.stringify({ error: diagnostic }) }], structuredContent: { error: diagnostic }, isError: true } });
    }
  } else send({ id, error: { code: -32601, message: `Unsupported method: ${method}` } });
}
