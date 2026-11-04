import { store } from '../state.js';
import { ICON_PATHS, svgIcon } from './icons.js';

/** Corner buttons for day/night and sound. They stay in sync with the in-world switches. */
export function setupToggles(root) {
  const themeBtn = root.querySelector('[data-toggle="theme"]');
  const soundBtn = root.querySelector('[data-toggle="sound"]');

  themeBtn.addEventListener('click', () => store.set({ theme: store.get().theme === 'dark' ? 'light' : 'dark' }));
  soundBtn.addEventListener('click', () => store.set({ sound: !store.get().sound }));

  const render = (state) => {
    const dark = state.theme === 'dark';
    themeBtn.innerHTML = svgIcon(dark ? ICON_PATHS.moon : ICON_PATHS.sun);
    themeBtn.setAttribute('aria-pressed', String(dark));
    themeBtn.setAttribute('aria-label', dark ? 'Switch to day' : 'Switch to night');
    themeBtn.title = dark ? 'Night (click for day)' : 'Day (click for night)';

    soundBtn.innerHTML = svgIcon(state.sound ? ICON_PATHS.soundOn : ICON_PATHS.soundOff);
    soundBtn.setAttribute('aria-pressed', String(state.sound));
    soundBtn.setAttribute('aria-label', state.sound ? 'Mute sound' : 'Turn sound on');
    soundBtn.title = state.sound ? 'Sound on (click to mute)' : 'Sound off (click to unmute)';

    document.documentElement.dataset.theme = state.theme;
  };
  render(store.get());
  store.subscribe(render);
}
