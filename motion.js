// Ressorts, à la manière d'Apple : on raisonne en "damping" (1 = sans rebond)
// et "response" (vivacité, en secondes), puis on échantillonne la courbe dans
// une fonction CSS linear() utilisable par les transitions et la Web Animations API.
const DURATION = 0.6; // s — les deux ressorts ci-dessous sont posés bien avant

function springCurve(damping, response, steps = 40) {
  const w = (2 * Math.PI) / response;
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const time = (i / steps) * DURATION;
    let x;
    if (damping >= 1) x = 1 - (1 + w * time) * Math.exp(-w * time);
    else {
      const wd = w * Math.sqrt(1 - damping * damping);
      x = 1 - Math.exp(-damping * w * time) * (Math.cos(wd * time) + ((damping * w) / wd) * Math.sin(wd * time));
    }
    points.push(i === steps ? 1 : Number(x.toFixed(4)));
  }
  return `linear(${points.join(',')})`;
}

/** Installe les courbes de ressort dans le CSS et renvoie celle par défaut. */
export function applySprings() {
  const fallback = { easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)', duration: 550 };
  if (!globalThis.CSS?.supports?.('transition-timing-function', 'linear(0, 1)')) return fallback;
  const smooth = springCurve(1, 0.4);
  const root = document.documentElement.style;
  root.setProperty('--spring', smooth);
  root.setProperty('--spring-bouncy', springCurve(0.8, 0.4));
  root.setProperty('--spring-dur', `${DURATION * 1000}ms`);
  return { easing: smooth, duration: DURATION * 1000 };
}

/** Distance qu'un geste lâché à `velocity` px/s parcourrait encore (décélération type scroll). */
export function project(velocity, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Résistance progressive au-delà d'une limite. */
export function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
