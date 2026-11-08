// The local observer plays existing samples only; it never evaluates an effect.
// Adapted from app.js native atlas playback, with a bounded time window/steps.
export async function startSavedPlayback(data) {
  const $ = id => document.getElementById(id);
  let index = 0, playing = false, epoch = 0, speed = 1, request = 0;
  const images = [], canvases = [], captions = [];
  try {
    for (const row of data.rows) {
      const img = new Image();
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('Saved atlas could not be loaded')); img.src = row.atlas; });
      images.push(img);
      const section = document.createElement('section'), caption = document.createElement('p'), canvas = document.createElement('canvas');
      canvas.width = data.size[0]; canvas.height = data.size[1]; canvas.style.width = `${canvas.width}px`; canvas.style.height = `${canvas.height}px`;
      canvas.setAttribute('aria-label', row.id); section.append(caption, canvas); $('stages').append(section); canvases.push(canvas); captions.push(caption);
    }
  } catch (error) { $('status').textContent = error.message + '. Open this file through the lab /artifacts URL with its saved runs intact.'; return; }
  const times = data.positions.map(t => t - data.positions[0]);
  const hold = times.length > 1 ? Math.min(...times.slice(1).map((t, i) => t - times[i]).filter(dt => dt > 0)) : 1 / data.fps;
  const duration = times.at(-1) + hold;
  function draw() {
    for (let row = 0; row < data.rows.length; row++) {
      const item = data.rows[row], sample = item.samples[index], canvas = canvases[row], ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = data.matte; ctx.fillRect(0, 0, canvas.width, canvas.height);
      const r = sample.rect; ctx.drawImage(images[row], r.x, r.y, r.w, r.h, item.offset[0], item.offset[1], r.w, r.h);
      captions[row].textContent = `${item.id} / ${item.run}\nrequested ${sample.requested.toFixed(6)}s | saved ${sample.actual.toFixed(6)}s | simulation ${sample.simulationTime ?? 'unknown'}${sample.duplicateOf !== null ? ' | repeated sample' : ''}${sample.clamped ? ' | clamped' : ''}`;
    }
    $('scrub').value = index; $('position').textContent = `${index + 1}/${times.length} | ${data.alignment === 'event' ? 'event offset ' : 'time '}${data.positions[index].toFixed(6)}s`;
    document.documentElement.dataset.frame = String(index); document.documentElement.dataset.playing = String(playing);
  }
  function pause() { playing = false; cancelAnimationFrame(request); $('play').textContent = 'Play'; draw(); }
  function tick(now) {
    if (!playing) return;
    let t = (now - epoch) / 1000 * speed;
    if (t >= duration && !$('loop').checked) { index = times.length - 1; pause(); return; }
    t %= duration; index = 0;
    while (index + 1 < times.length && times[index + 1] <= t) index++;
    draw(); request = requestAnimationFrame(tick);
  }
  function play() { cancelAnimationFrame(request); playing = true; epoch = performance.now() - times[index] / speed * 1000; $('play').textContent = 'Pause'; draw(); request = requestAnimationFrame(tick); }
  $('play').onclick = () => playing ? pause() : play();
  $('prev').onclick = () => { index = Math.max(0, index - 1); pause(); };
  $('next').onclick = () => { index = Math.min(times.length - 1, index + 1); pause(); };
  $('scrub').max = times.length - 1; $('scrub').oninput = e => { index = Number(e.target.value); pause(); };
  $('speed').onchange = e => { const resume = playing; pause(); speed = Number(e.target.value); if (resume) play(); };
  $('status').textContent = 'Native pixels; saved samples and actual clocks only. Playback can skip display updates on a slow client. Use frame steps/pages for inspection. This page does not certify observation or artistic quality.';
  draw();
}
