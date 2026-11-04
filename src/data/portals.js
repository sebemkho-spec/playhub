/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PORTALS: everything a visitor sees when they walk into a portal.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Edit any entry, or copy one to add a new portal. Fields:
 *
 *   id        unique name (letters/numbers)
 *   title     big bold heading on the card
 *   body      card text. Basic HTML is fine: <p>, <strong>, <em>, <a href="">
 *   image     picture that pokes out above the card (put files in /public/images/)
 *   link      where "Learn More" goes (leave '' to hide the button)
 *   linkLabel optional text for that button (default "Learn More")
 *   socials   icons under the text: [{ icon, url }]
 *             icons: github, linkedin, instagram, x, youtube, spotify, soundcloud,
 *                    applemusic, bandcamp, tiktok, bluesky, substack, medium,
 *                    discord, letterboxd, goodreads, email, website
 *
 *   shape     what the portal looks like in the world:
 *               'gate'   marble pillars, like the original
 *               'ring'   an upright vinyl record with floating notes
 *               'frame'  a gilded picture frame on little feet
 *               'bubble' a speech bubble standing on its tail
 *               'cloud'  a thought cloud with trailing puffs
 *   color     glow colour of the portal
 *   position  [x, z] on the island (see src/world/layout.js for the map),
 *             or [x, y, z] to set the height yourself
 *   rotation  which way the portal faces, in degrees (0 = toward the front of the island)
 *   size      optional scale, default 1
 *   triggerRadius  optional: how close (world units) you walk before the card opens
 */

export const PORTALS = [
  {
    id: 'about',
    title: "Hi, I'm Seb",
    body: `
      <p>Welcome to the playhub, a little world I'm building to share the things I make and think about.</p>
      <p>I like reading, writing, conjuring elaborate machinations of the mind, and exercising my own agency.
      <strong>Wander into the other portals to look around, or say hi below.</strong></p>`,
    image: '/images/portals/about.svg',
    link: 'https://example.com/about',
    socials: [
      { icon: 'github', url: 'https://github.com/' },
      { icon: 'linkedin', url: 'https://www.linkedin.com/' },
      { icon: 'instagram', url: 'https://www.instagram.com/' },
      { icon: 'email', url: 'mailto:you@email.com' },
    ],
    shape: 'gate',
    color: '#3ff3ff',
    position: [0.412, -4.844],
    rotation: 90,
  },
  {
    id: 'music',
    title: 'Music',
    body: `
      <p>Songs I can't stop replaying, playlists for every kind of mood, and maybe a few things I've made myself.</p>
      <p><strong>Click "Learn More" to have a listen.</strong></p>`,
    image: '/images/portals/music.svg',
    link: 'https://open.spotify.com/',
    socials: [
      { icon: 'spotify', url: 'https://open.spotify.com/' },
      { icon: 'soundcloud', url: 'https://soundcloud.com/' },
      { icon: 'youtube', url: 'https://www.youtube.com/' },
    ],
    shape: 'ring',
    color: '#c77dff',
    position: [-6.1, 0.7],
    rotation: 16,
  },
  {
    id: 'gallery',
    title: 'The Gallery',
    body: `
      <p>Things I've built, drawn and tinkered with: tiny 3D worlds, experiments and side projects.</p>
      <p><strong>Click "Learn More" to see the whole collection.</strong></p>`,
    image: '/images/portals/gallery.svg',
    link: 'https://example.com/gallery',
    socials: [
      { icon: 'github', url: 'https://github.com/' },
      { icon: 'instagram', url: 'https://www.instagram.com/' },
    ],
    shape: 'frame',
    color: '#ffc94d',
    position: [2.319, -14.28],
    rotation: 0,
  },
  {
    id: 'joking',
    title: "Surely You're Joking, Seb",
    body: `
      <p>Stories, odd adventures and mostly-true anecdotes, told in the spirit of a certain curious physicist.</p>
      <p><strong>Click "Learn More" for the latest tale.</strong></p>`,
    image: '/images/portals/joking.svg',
    link: 'https://example.com/stories',
    socials: [
      { icon: 'substack', url: 'https://substack.com/' },
      { icon: 'x', url: 'https://x.com/' },
    ],
    shape: 'bubble',
    color: '#ff8a5c',
    position: [9.75, -8.7],
    rotation: 8,
  },
  {
    id: 'thoughts',
    title: 'Thoughts',
    body: `
      <p>Notes, essays and half-formed ideas: the elaborate machinations, written down.</p>
      <p><strong>Click "Learn More" to read some thoughts I have.</strong></p>`,
    image: '/images/portals/thoughts.svg',
    link: 'https://docs.google.com/document/d/1f8xhi_UoTeVrPuaVMghEhQ6YIGrKxA7oFFVK8gw9YKk/edit?usp=sharing',
    socials: [
      { icon: 'medium', url: 'https://medium.com/' },
      { icon: 'email', url: 'mailto:you@email.com' },
    ],
    shape: 'cloud',
    color: '#8fd8ff',
    position: [-8.318, -11.875],
    rotation: 90,
  },
];
