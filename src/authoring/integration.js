// Extracted unchanged stepping order from motion.integrate. A reusable table
// avoids re-integrating every historical point from birth; material is absent.
import { ballistic } from './motion.js';
import { point, positive, finite, fail } from './contract.js';

export function simulation({ position, velocity, born = 0, life = 1, acceleration = [0, 0], drag = 0, forces = [], kill, birth = null }) {
  point(position, 'motion.position'); point(velocity, 'motion.velocity'); point(acceleration, 'motion.acceleration');
  finite(born, 'motion.born'); positive(life, 'motion.life');
  const damping = typeof drag === 'number' ? [drag, drag] : point(drag, 'motion.drag'); damping.forEach((v) => positive(v, 'motion.drag', true));
  if (!Array.isArray(forces) || forces.some((fn) => typeof fn !== 'function') || (kill !== undefined && typeof kill !== 'function')) fail('motion.forces', 'forces and kill must be pure callbacks');
  const table = [{ position: [...position], velocity: [...velocity] }]; let killedAge = null;
  const context = (q, tick) => ({ ...q, age: tick / 120, age01: tick / 120 / life, time: born + tick / 120, born, life, birth });
  if (kill?.(context(table[0], 0))) killedAge = 0;
  return { sample(age) {
    positive(age, 'motion.age', true); const ticks = Math.floor(age * 120 + 1e-8);
    if (ticks > 1440) fail('motion.age', 'fixed-step motion exceeds 12 seconds per particle', 'BUDGET_EXCEEDED');
    while (table.length <= ticks && killedAge === null) {
      const tick = table.length - 1, state = context(table[tick], tick), a = [...acceleration];
      for (const force of forces) { const value = force(state); point(value, 'motion.force.output'); a[0] += value[0]; a[1] += value[1]; }
      const q = ballistic({ ...table[tick], acceleration: a, drag, age: 1 / 120 });
      point(q.position, 'motion.integrate.position'); point(q.velocity, 'motion.integrate.velocity'); table.push(q);
      if (kill?.(context(q, tick + 1))) killedAge = (tick + 1) / 120;
    }
    const stopped = killedAge !== null && ticks >= table.length - 1, index = Math.min(ticks, table.length - 1), q = table[index];
    return { position: [...q.position], velocity: [...q.velocity], alive: !stopped, simulationAge: index / 120, killedAge: stopped ? killedAge : null };
  } };
}
