/**
 * Songs and clips inside a card (see the Music card in src/data/portals.js):
 *
 *   <button data-track="/music/song.mp3">song name</button>   a round play button
 *   <video data-clip src="/music/clip.mp4" poster="…"></video>   a clip you tap to play
 *
 * Only one plays at a time, always with sound (even if the island's sound is off: pressing
 * play asks for it). `onChange(true)` fires when something starts, so the island's own sounds
 * can go quiet, and `onChange(false)` once nothing is playing any more: it ended, was paused,
 * or the card closed.
 */

const RING = 2 * Math.PI * 20; // the progress ring's length (radius 20)
const PLAY = 'M16.6 13.9c0-1.2 1.3-1.9 2.3-1.3l9.6 6.9c.9.6.9 1.9 0 2.5l-9.6 6.9c-1 .7-2.3-.1-2.3-1.3z';
const PAUSE = 'M14.8 13.6c0-.9.6-1.5 1.5-1.5h1.9c.9 0 1.5.6 1.5 1.5v14.8c0 .9-.6 1.5-1.5 1.5h-1.9c-.9 0-1.5-.6-1.5-1.5zm7.9 0c0-.9.6-1.5 1.5-1.5h1.9c.9 0 1.5.6 1.5 1.5v14.8c0 .9-.6 1.5-1.5 1.5h-1.9c-.9 0-1.5-.6-1.5-1.5z';
const BIG_PLAY = `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="rgba(0,0,0,0.45)"/><path d="M19 15.8c0-1.3 1.4-2 2.4-1.3l11.4 7.9c.9.7.9 2 0 2.7l-11.4 7.9c-1 .7-2.4 0-2.4-1.3z" fill="#fff"/></svg>`;
const BIG_PAUSE = `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="rgba(0,0,0,0.45)"/><path d="M17.5 15.5h4.6v17h-4.6zm8.4 0h4.6v17h-4.6z" fill="#fff"/></svg>`;

const clock = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '');

export function wireCardMedia(root, { onChange = () => {} } = {}) {
  const players = [];
  let current = null;
  let quietTimer = 0;

  /** Something started: stop the others, and hush the island at once. */
  const started = (player) => {
    for (const p of players) if (p !== player) p.pause();
    current = player;
    clearTimeout(quietTimer);
    onChange(true);
  };
  /** Something stopped: once nothing is playing (allowing a beat to switch songs), let the island back in. */
  const stopped = () => {
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => {
      if (!players.some((p) => p.playing)) {
        current = null;
        onChange(false);
      }
    }, 250);
  };

  root.querySelectorAll('[data-track]').forEach((button) => players.push(trackPlayer(button, { started, stopped })));
  root.querySelectorAll('video[data-clip]').forEach((video) => players.push(clipPlayer(video, { started, stopped })));

  return {
    get playing() {
      return !!current;
    },
    /** Stop everything (the card is closing or changing). */
    stop() {
      clearTimeout(quietTimer);
      const wasPlaying = players.some((p) => p.playing);
      players.forEach((p) => p.reset());
      current = null;
      if (wasPlaying) onChange(false);
    },
  };
}

/** A song: a round play/pause button, a ring that fills as it plays, and the time under its name. */
function trackPlayer(button, { started, stopped }) {
  const name = button.textContent.trim();
  button.type = 'button';
  button.classList.add('track');
  button.innerHTML = `
    <span class="track__icon"><svg viewBox="0 0 42 42" aria-hidden="true">
      <circle class="track__disc" cx="21" cy="21" r="17" />
      <path class="track__glyph" d="${PLAY}" />
      <circle class="track__ring" cx="21" cy="21" r="20" stroke-dasharray="${RING}" stroke-dashoffset="${RING}" />
    </svg></span>
    <span class="track__text"><span class="track__name"></span><span class="track__time" aria-hidden="true"></span></span>`;
  button.querySelector('.track__name').textContent = name;
  const glyph = button.querySelector('.track__glyph');
  const ring = button.querySelector('.track__ring');
  const time = button.querySelector('.track__time');

  const audio = new Audio();
  audio.preload = 'none'; // nothing downloads until someone presses play
  audio.src = button.dataset.track;
  let frame = 0;

  const label = () => button.setAttribute('aria-label', `${audio.paused ? 'Play' : 'Pause'} ${name}`);
  const draw = () => {
    const k = audio.duration ? audio.currentTime / audio.duration : 0;
    ring.setAttribute('stroke-dashoffset', String(RING * (1 - k)));
    time.textContent = audio.currentTime > 0 || !audio.paused ? `${clock(audio.currentTime)} / ${clock(audio.duration)}` : '';
  };
  const tick = () => {
    draw();
    frame = requestAnimationFrame(tick);
  };

  audio.addEventListener('play', () => {
    glyph.setAttribute('d', PAUSE);
    button.classList.add('is-started');
    label();
    cancelAnimationFrame(frame);
    tick();
    started(player);
  });
  audio.addEventListener('pause', () => {
    glyph.setAttribute('d', PLAY);
    label();
    cancelAnimationFrame(frame);
    draw();
    stopped();
  });
  audio.addEventListener('ended', () => {
    audio.currentTime = 0;
    button.classList.remove('is-started');
    draw();
  });
  audio.addEventListener('error', () => {
    console.warn(`[playhub] Couldn't play "${button.dataset.track}" (${name}). Is the file in public/?`);
    time.textContent = "couldn't load";
    reset();
  });

  button.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });

  function reset() {
    audio.pause();
    cancelAnimationFrame(frame);
    if (audio.currentTime) audio.currentTime = 0;
    glyph.setAttribute('d', PLAY);
    button.classList.remove('is-started');
    ring.setAttribute('stroke-dashoffset', String(RING));
    if (time.textContent !== "couldn't load") time.textContent = '';
    label();
  }
  label();

  const player = {
    get playing() {
      return !audio.paused;
    },
    pause: () => audio.pause(),
    reset,
  };
  return player;
}

/** A clip: tap to play or pause, a thin bar along the bottom shows how far in it is. */
function clipPlayer(video, { started, stopped }) {
  video.playsInline = true; // (iPhones would otherwise jump to fullscreen)
  video.preload = 'none';
  video.removeAttribute('controls');
  video.muted = false;
  const box = document.createElement('div');
  box.className = 'clip';
  video.replaceWith(box);
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'clip__play';
  const bar = document.createElement('span');
  bar.className = 'clip__bar';
  box.append(video, play, bar);
  // the poster's shape, so nothing jumps when the clip loads
  if (video.dataset.ratio) video.style.aspectRatio = video.dataset.ratio;

  const title = video.getAttribute('aria-label') || 'the clip';
  let frame = 0;
  const draw = () => {
    bar.style.transform = `scaleX(${video.duration ? video.currentTime / video.duration : 0})`;
  };
  const tick = () => {
    draw();
    frame = requestAnimationFrame(tick);
  };
  const show = () => {
    play.innerHTML = video.paused ? BIG_PLAY : BIG_PAUSE;
    play.setAttribute('aria-label', `${video.paused ? 'Play' : 'Pause'} ${title}`);
    box.classList.toggle('is-playing', !video.paused);
  };

  video.addEventListener('play', () => {
    show();
    cancelAnimationFrame(frame);
    tick();
    started(player);
  });
  video.addEventListener('pause', () => {
    show();
    cancelAnimationFrame(frame);
    draw();
    stopped();
  });
  video.addEventListener('ended', () => {
    bar.style.transform = 'scaleX(0)';
    video.load(); // back to the poster
  });
  video.addEventListener('error', () => {
    if (!video.error) return;
    console.warn(`[playhub] Couldn't play "${video.currentSrc || video.getAttribute('src')}". Is the file in public/?`);
    reset();
  });

  play.addEventListener('click', () => {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  });

  function reset() {
    video.pause();
    cancelAnimationFrame(frame);
    bar.style.transform = 'scaleX(0)';
    if (video.currentTime) {
      video.currentTime = 0;
      video.load();
    }
    show();
  }
  show();

  const player = {
    get playing() {
      return !video.paused;
    },
    pause: () => video.pause(),
    reset,
  };
  return player;
}
