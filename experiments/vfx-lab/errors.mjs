import {fileURLToPath} from 'node:url';

export class LabError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    Object.assign(this, details);
  }
}

export function errorResult(error) {
  // Keep native failures native, but report the first author/reference call
  // site rather than sending a TypeError back to the tool-schema directory.
  const frame=typeof error?.stack==='string'?error.stack.split('\n').map(line=>line.match(/((?:file:\/\/)?[^\s()]*\/(?:experiments\/vfx-lab\/(?:drafts|effects)|src\/fx)\/[^\s()?]+\.(?:m?js))(?:\?[^\s():]*)?:(\d+):(\d+)/)).find(Boolean):null;
  let location;
  if(frame){const absolute=frame[1].startsWith('file://')?fileURLToPath(frame[1]):frame[1],frozen=absolute.includes('athanor-vfx-replay-');
    location={file:frozen?absolute.slice(absolute.indexOf('/experiments/')+1):absolute,line:Number(frame[2]),column:Number(frame[3]),source:frozen?'frozen snapshot':'author/reference call site',scope:'Call site from the original stack, not an inferred root cause'};
  }
  const details=location?{...(error?.details&&typeof error.details==='object'?error.details:{}),location}:error?.details;
  return {
    code: error?.code ?? "TOOL_ERROR", message: error?.message ?? String(error),
    recovery: error?.recovery ?? (location?'Inspect the reported author JavaScript file/line, preserve this original error, fix the draft and render a new revision. Frozen runs remain unchanged.':"Read the short directory with: node experiments/vfx-lab/cli.mjs tools; request one exact schema with inspect ref:{kind:'tool',id:'fx_<name>'}"),
    ...(error?.path||location ? { path: error?.path??location.file } : {}),
    ...(details ? { details } : {}),
    ...(error?.callRef ? { callRef: error.callRef } : {}),
  };
}
