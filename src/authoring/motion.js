import { point, positive, finite, fail } from './contract.js';
import { sample } from './path.js';

export function ballistic({ position, velocity, acceleration = [0, 0], drag = 0, age }) {
  point(position, 'motion.position'); point(velocity, 'motion.velocity'); point(acceleration, 'motion.acceleration'); positive(age, 'motion.age', true);
  const damping = typeof drag === 'number' ? [drag, drag] : point(drag, 'motion.drag'); damping.forEach((v) => positive(v, 'motion.drag', true));
  const axes = position.map((x, i) => {
    const k = damping[i], z = k * age, e = Math.exp(-z), f = k > 0 ? -Math.expm1(-z) / k : age;
    const g = k === 0 || z < 1e-4 ? age * age * (0.5 - z / 6 + z * z / 24 - z * z * z / 120) : (age - f) / k;
    return [x + velocity[i] * f + acceleration[i] * g, velocity[i] * e + acceleration[i] * f];
  });
  return { position: axes.map((a) => a[0]), velocity: axes.map((a) => a[1]) };
}
export function along(path, { age, duration, from = 0, to = 1, easing = (u) => u }) {
  finite(age, 'motion.along.age'); positive(duration, 'motion.along.duration'); finite(from, 'motion.along.from'); finite(to, 'motion.along.to');
  const u = easing(Math.max(0, Math.min(1, age / duration))); finite(u, 'motion.along.easing');
  if (u < 0 || u > 1) fail('motion.along.easing', 'path progress overshoot requires an explicit path boundary strategy');
  return sample(path, from + (to - from) * u, { boundary: 'error' });
}

// Force callbacks compose acceleration, rather than mixing frame-dependent
// position edits with velocity. Constant forces retain the analytic kernel.
export function radial({ center = [0, 0], strength = 0, tangential = 0, startAge = 0 } = {}) {
  if (typeof center !== 'function') point(center, 'motion.radial.center');
  finite(strength, 'motion.radial.strength'); finite(tangential, 'motion.radial.tangential'); positive(startAge, 'motion.radial.startAge', true);
  return (state) => {
    if (state.age < startAge) return [0, 0];
    const target = typeof center === 'function' ? center(state) : center; point(target, 'motion.radial.center');
    const dx = state.position[0] - target[0], dy = state.position[1] - target[1], r = Math.hypot(dx, dy);
    return r < 1e-9 ? [0, 0] : [(dx * strength - dy * tangential) / r, (dy * strength + dx * tangential) / r];
  };
}

export function attract({ target, stiffness = 60, damping = 10, startAge = 0 } = {}) {
  if (typeof target !== 'function') point(target, 'motion.attract.target');
  positive(stiffness, 'motion.attract.stiffness', true); positive(damping, 'motion.attract.damping', true); positive(startAge, 'motion.attract.startAge', true);
  return (state) => {
    if (state.age < startAge) return [0, 0];
    const q = typeof target === 'function' ? target(state) : target; point(q, 'motion.attract.target');
    return q.map((v, i) => (v - state.position[i]) * stiffness - state.velocity[i] * damping);
  };
}

export function integrate({ position, velocity, age, born = 0, life = 1, acceleration = [0, 0], drag = 0, forces = [], kill, birth = null }) {
  point(position, 'motion.position'); point(velocity, 'motion.velocity'); point(acceleration, 'motion.acceleration');
  positive(age, 'motion.age', true); finite(born, 'motion.born'); positive(life, 'motion.life');
  const damping = typeof drag === 'number' ? [drag, drag] : point(drag, 'motion.drag'); damping.forEach((v) => positive(v, 'motion.drag', true));
  if (!Array.isArray(forces) || forces.some((fn) => typeof fn !== 'function') || (kill !== undefined && typeof kill !== 'function')) fail('motion.forces', 'forces and kill must be pure callbacks');
  const ticks = Math.floor(age * 120 + 1e-8);
  if (ticks > 1440) fail('motion.age', 'fixed-step motion exceeds 12 seconds per particle', 'BUDGET_EXCEEDED');
  let q = { position: [...position], velocity: [...velocity] };
  const context = (tick) => ({ ...q, age: tick / 120, age01: tick / 120 / life, time: born + tick / 120, born, life, birth });
  if (kill?.(context(0))) return { ...q, alive: false, simulationAge: 0, killedAge: 0 };
  for (let tick = 0; tick < ticks; tick++) {
    const state = context(tick), a = [...acceleration];
    for (const force of forces) { const value = force(state); point(value, 'motion.force.output'); a[0] += value[0]; a[1] += value[1]; }
    q = ballistic({ ...q, acceleration: a, drag, age: 1 / 120 });
    point(q.position, 'motion.integrate.position'); point(q.velocity, 'motion.integrate.velocity');
    if (kill?.(context(tick + 1))) return { ...q, alive: false, simulationAge: (tick + 1) / 120, killedAge: (tick + 1) / 120 };
  }
  return { ...q, alive: true, simulationAge: ticks / 120, killedAge: null };
}
