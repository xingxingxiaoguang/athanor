const $ = (selector) => document.querySelector(selector);
const state = { runs: [], images: new Map(), playing: true, t: 0, last: 0, busy: false };
const artifact = (run, file) => `/artifacts/${run}/${file}`;
const status = (message, error = false) => { $("#status").textContent = message; $("#status").classList.toggle("error", error); };

async function call(name, args) {
  const response = await fetch("/api/call", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, arguments: args }) });
  const data = await response.json();
  if (!data.ok) throw new Error(data.error ?? "操作失败");
  return data.result;
}
async function action(message, fn) {
  if (state.busy) return;
  state.busy = true; status(message);
  document.querySelectorAll(".actions button,#render,#demo,#inspect").forEach((b) => b.disabled = true);
  try { await fn(); status("已完成 · 可以继续观察和修改"); }
  catch (error) { status(error.message, true); }
  finally { state.busy = false; document.querySelectorAll(".actions button,#render,#demo,#inspect").forEach((b) => b.disabled = false); }
}
const image = (src) => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error("图像加载失败")); img.src = src; });

async function show(runs) {
  for (const run of runs) for (const channel of ["preview", "color", "light", "combined"]) {
    const key = `${run.run}/${channel}`;
    if (!state.images.has(key)) state.images.set(key, await image(artifact(run.run, `${channel}.png`)));
  }
  state.runs = runs; state.t = runs[0].events.release ?? 0;
  const latest = runs.at(-1);
  if (![...$("#effect").options].some((o) => o.value === latest.id)) $("#effect").add(new Option(`${latest.name} · ${latest.id}`, latest.id));
  $("#effect").value = latest.id;
  $("#direction").value = latest.options.direction ?? "crown";
  $("#direction").disabled = latest.id !== "lab/cryo-bloom" && !latest.id.startsWith("draft/");
  $("#seed").value = latest.options.seed ?? 1;
  if (![...$("#bg").options].some((o) => o.value === latest.background)) $("#bg").add(new Option(latest.background, latest.background));
  $("#bg").value = latest.background;
  const glow = latest.options.glow ?? (latest.options.light ?? 1) * 0.35;
  $("#glow").max = Math.max(1, glow); $("#glow").value = glow; $("#glow-value").textContent = glow.toFixed(2);
  $("#secondary").checked = latest.options.secondary ?? true; $("#note").value = latest.note;
  $("#stages").replaceChildren();
  for (const [i, run] of runs.entries()) {
    const div = document.createElement("div"); div.className = "stage";
    const canvas = document.createElement("canvas"); canvas.width = run.size[0]; canvas.height = run.size[1]; canvas.setAttribute("aria-label", `${run.name} ${run.options.direction ?? run.id}`);
    const caption = document.createElement("div"); caption.className = "caption";
    const title = document.createElement("span"); title.textContent = `${String.fromCharCode(65 + i)} / ${run.options.direction === "wave" ? "碎冰波" : run.options.direction === "crown" ? "晶冠" : run.name}`;
    const id = document.createElement("small"); id.textContent = run.run.slice(0, 12);
    caption.append(title, id); div.append(canvas, caption); $("#stages").append(div);
  }
  $("#count").textContent = `${runs.length} 个版本 / ${runs[0].fps} FPS`;
  $("#timeline").max = Math.max(...runs.map((m) => m.duration));
  $("#events").replaceChildren();
  for (const [name, time] of Object.entries(runs[0].events)) {
    const button = document.createElement("button"); button.textContent = `${name} ${time.toFixed(2)}s`;
    button.onclick = () => { state.t = time; pause(); draw(); }; $("#events").append(button);
  }
  draw();
}
function draw() {
  const channel = $("#channel").value;
  for (const [i, run] of state.runs.entries()) {
    const canvas = $("#stages").children[i].querySelector("canvas"), ctx = canvas.getContext("2d");
    const t = run.loop ? state.t % run.duration : Math.min(state.t, run.duration), f = run.frames.reduce((a, b) => Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a);
    ctx.clearRect(0, 0, ...run.size);
    ctx.drawImage(state.images.get(`${run.run}/${channel}`), f.rect.x, f.rect.y, ...run.size, 0, 0, ...run.size);
    const available = Math.max(1, Math.floor((canvas.parentElement.clientWidth - 16) / run.size[0]));
    const scale = $("#native").checked ? 1 : Math.min(3, available);
    canvas.style.width = `${run.size[0] * scale}px`; canvas.style.height = `${run.size[1] * scale}px`;
  }
  $("#timeline").value = state.t; $("#time").textContent = `${state.t.toFixed(3)} s`;
}
function pause() { state.playing = false; $("#play").textContent = "播放"; }
$("#play").onclick = () => { state.playing = !state.playing; $("#play").textContent = state.playing ? "暂停" : "播放"; };
$("#timeline").oninput = (event) => { state.t = Number(event.target.value); pause(); draw(); };
$("#channel").onchange = draw; $("#native").onchange = draw; window.addEventListener("resize", draw);
$("#glow").oninput = (event) => $("#glow-value").textContent = Number(event.target.value).toFixed(2);

function renderArgs(direction) {
  const id = $("#effect").value;
  const options = { seed: Number($("#seed").value) };
  if (id === "lab/cryo-bloom" || id.startsWith("draft/")) Object.assign(options, { direction: direction ?? $("#direction").value, glow: Number($("#glow").value), secondary: $("#secondary").checked });
  else options.light = Number($("#glow").value) / 0.35;
  const referenceEvents = { "ice/frost-nova": { release: 0.42 }, "melee/sword-slash": { release: 0, contact: 0.06 }, "explosions/small-explosion": { release: 0 }, "arcane/portal": { release: 0 }, "fire/torch": { release: 0 } };
  return { id, options, background: $("#bg").value, fps: 30, events: referenceEvents[id] ?? {}, note: $("#note").value };
}
$("#demo").onclick = () => action("正在渲染两个结构不同的方向…", async () => {
  $("#effect").value = "lab/cryo-bloom";
  const a = await call("fx_render", renderArgs("crown")), b = await call("fx_render", renderArgs("wave"));
  await show([a, b]); state.playing = true; $("#play").textContent = "暂停";
});
$("#render").onclick = () => action("正在保存源码快照并生成分层图像…", async () => {
  const run = await call("fx_render", renderArgs());
  await show([...state.runs.slice(-1), run].slice(-2));
});
$("#inspect").onclick = () => action("正在读取参考…", async () => {
  const result = await call("fx_inspect", { id: $("#effect").value });
  $("#source").textContent = JSON.stringify({ events: result.events, recipes: result.recipes }, null, 2) + "\n\n" + result.source;
  $("#source-dialog").showModal();
});
$("#close-source").onclick = () => $("#source-dialog").close();
$("#effect").onchange = async () => {
  $("#direction").disabled = $("#effect").value !== "lab/cryo-bloom" && !$("#effect").value.startsWith("draft/");
  try {
    const result = await call("fx_inspect", { id: $("#effect").value }), recipe = result.recipes[0];
    $("#recipe-name").textContent = recipe?.name ?? "先确定主轮廓与关键事件";
    $("#recipe-text").textContent = recipe?.mechanism ?? "先看实际画面，再决定借鉴什么与修改什么。";
  } catch (error) { status(error.message, true); }
};
function current() { if (!state.runs.length) throw new Error("请先渲染一个版本"); return state.runs.at(-1); }
$("#compare").onclick = () => action("正在按 release 事件对齐…", async () => {
  if (state.runs.length < 2) throw new Error("请先生成两个版本，或运行示例实验");
  const result = await call("fx_compare", { runs: state.runs.map((m) => m.run), event: "release" });
  const img = document.createElement("img"); img.alt = "释放事件前后，两版特效在相同像素尺度下的对比"; img.src = artifact(result.run, "compare.png");
  const p = document.createElement("p"); p.className = "hint"; p.textContent = "同一锚点 · 原始像素 · 从释放前 0.1 秒到释放后 0.7 秒。可横向滚动查看；画面由创作者判断，没有自动评分。";
  const view = document.createElement("div"); view.className = "comparison-view"; view.tabIndex = 0; view.setAttribute("aria-label", "原始像素对比，可横向滚动"); view.append(img);
  $("#evidence").replaceChildren(p, view);
});
$("#validate").onclick = () => action("正在检查颜色、光、结束帧及跨帧率复现…", async () => {
  const run = current(), result = await call("fx_validate", { id: run.id, options: run.options });
  const sameSource = result.sourceDigest === run.sourceDigest;
  const title = document.createElement("p"); title.textContent = result.passed ? "✓ 采样技术检查通过" : `发现 ${result.errors.length} 项需要修复的问题`;
  const context = document.createElement("p"); context.className = "hint";
  context.textContent = `${sameSource ? "源码与预览版本一致" : "源码已变化，请重新渲染后再对照判断"}。检查了 ${result.coverage.times.length} 个时刻、${result.coverage.seeds.length} 个种子，以及颜色和光两个通道。这不是逐帧或美感认证。`;
  const names = { END_NOT_EMPTY: "结束时仍有残留", COLOR_SPILL: "像素超出画布", LIGHT_SPILL: "亮光超出画布边缘", NONDETERMINISTIC: "相同条件下无法复现", LOOP_PERIOD: "循环相同相位不一致", LOOP_REVIEW: "请连续播放至少三个周期，观察衔接速度", CLOCK_DRIFT: "不同更新频率下的结果不一致", DRAW_MUTATES_STATE: "重复绘制改变了状态", DRAWS_NOTHING: "采样时刻没有可见内容", UNSEEDED_TIME: "使用了未固定的随机数或系统时间" };
  const issues = document.createElement("ul");
  for (const issue of [...result.errors, ...result.diagnostics]) {
    const li = document.createElement("li"); li.textContent = `${names[issue.code] ?? issue.message}${issue.seed === undefined ? "" : `（种子 ${issue.seed}）`}`; issues.append(li);
  }
  const details = document.createElement("details"), summary = document.createElement("summary"), pre = document.createElement("pre");
  summary.textContent = "查看检查证据（JSON）"; pre.textContent = JSON.stringify(result, null, 2); details.append(summary, pre);
  $("#evidence").replaceChildren(title, context, issues, details);
});
$("#export").onclick = () => action("正在导出已保存的版本…", async () => {
  const result = await call("fx_export", { run: current().run });
  $("#evidence").replaceChildren();
  for (const file of result.files) {
    const a = document.createElement("a"); a.textContent = file.split("/").at(-1); a.download = a.textContent;
    a.href = "/artifacts/" + file.split("/records/vfx-lab/")[1]; $("#evidence").append(a);
  }
  const p = document.createElement("p"); p.className = "hint"; p.textContent = "颜色层使用普通透明合成，光层使用加法混合。combined.png 是便捷的烘焙版本，在不同背景上可能有差异。"; $("#evidence").append(p);
});

function tick(now) {
  const dt = Math.min((now - state.last) / 1000, 0.1); state.last = now;
  if (state.playing && state.runs.length) {
    const duration = Math.max(...state.runs.map((m) => m.duration)); state.t += dt;
    if (state.runs.every((m) => m.loop)) state.t %= duration;
    else if (state.t > duration + 0.4) state.t = 0;
    draw();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
try {
  const tools = await fetch("/api/tools").then((r) => r.json());
  $("#tools").textContent = tools.map((t) => `${t.name}\n${t.description}\n${JSON.stringify(t.inputSchema, null, 2)}`).join("\n\n");
  const runs = await fetch("/api/runs").then((r) => r.json());
  if (runs.length) await show(runs.slice(0, 2).reverse());
} catch (error) { status(error.message, true); }
