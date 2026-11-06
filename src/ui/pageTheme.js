/**
 * Turns the `page` section of a theme into the CSS variables that
 * src/ui/styles.css uses. vite.config.js puts the result straight into
 * index.html, so the loading screen has the right colours from the first frame.
 * (Plain JavaScript with no imports, so it also runs inside the dev server.)
 */
export function pageThemeCss(page) {
  const shared = {
    '--loader-bg': page.loader.background,
    '--loader-ink': page.loader.text,
    '--loader-shadow': page.loader.textShadow,
    '--loader-block': page.loader.block,
    '--loader-block-top': page.loader.blockTop,
    '--plain-paper': page.loader.plain.paper,
    '--plain-ink': page.loader.plain.ink,
    '--plain-link': page.loader.plain.link,
    '--plain-glitch-a': page.loader.plain.glitch[0],
    '--plain-glitch-b': page.loader.plain.glitch[1],
    '--card-bg': page.card.background,
    '--ink': page.card.text,
    '--card-shadow': page.card.shadow,
    '--card-image-shadow': page.card.imageShadow,
    '--card-close': page.card.close,
    '--accent': page.card.accent,
    '--accent-ink': page.card.accentText,
    '--card-x': page.card.closeX,
    '--card-x-shadow': page.card.closeXShadow,
    '--card-x-flat': page.card.closeXFlat,
    '--joy-ring': page.joystick.ring,
    '--joy-fill': page.joystick.fill,
    '--joy-knob': page.joystick.knob,
    '--joy-knob-shadow': page.joystick.knobShadow,
    '--joy-run': page.joystick.running,
    '--eggs-found': page.eggs.found,
    '--eggs-glow': page.eggs.glow,
  };
  const mood = (name) => ({
    '--page-bg': page.background[name],
    '--hud-bg': page.buttons[name].background,
    '--hud-ink': page.buttons[name].icon,
    '--hud-ring': page.buttons[name].ring,
    '--hud-shadow': page.buttons[name].shadow,
  });
  const block = (selector, vars) => `${selector}{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`;
  return [
    block(':root', { ...shared, ...mood('day') }),
    block(":root[data-theme='dark']", mood('night')),
  ].join('\n');
}
