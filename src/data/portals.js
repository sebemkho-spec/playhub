/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PORTALS: everything a visitor sees when they walk into a portal.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Edit any entry, or copy one to add a new portal. Fields:
 *
 *   id        unique name (letters/numbers)
 *   title     big bold heading on the card
 *   body      card text. Basic HTML is fine: <p>, <strong>, <em>, <a href="">, <img>
 *             songs:  <button data-track="/music/song.mp3">song name</button>
 *             clips:  <video data-clip src="/music/clip.mp4" poster="/music/clip.jpg"></video>
 *             (they play with sound, one at a time, and the island goes quiet meanwhile)
 *   image     picture that pokes out above the card (put files in /public/images/)
 *   link      where "Learn More" goes (leave '' to hide the button)
 *   linkLabel optional text for that button (default "Learn More")
 *   socials   icons under the text: [{ icon, url }]
 *             icons: github, linkedin, instagram, x, youtube, spotify, soundcloud,
 *                    applemusic, bandcamp, tiktok, bluesky, substack, medium,
 *                    discord, letterboxd, goodreads, email, website
 *   layout    optional: 'quote' centres everything, with a bigger title and text
 *             (for a card that's just a quote: put it in <blockquote>, the author in <cite>);
 *             'note' is a few bold lines, the title being the first of them;
 *             'return' is the way back home (a plain-HTML style link, then the socials);
 *             'music' and 'stories' are the Music and "Surely You're Joking" cards' own
 *             layouts (their styles are in src/ui/styles.css)
 *
 *   shape     what the portal looks like in the world:
 *               'gate'   marble pillars, like the original
 *               'ring'   an upright vinyl record with floating notes
 *               'frame'  a gilded picture frame on a plinth
 *               'bubble' a speech bubble standing on its tail
 *               'cloud'  a thought cloud with trailing puffs
 *               'egg'    a small glowing painted egg in a ring of puffs
 *   (glow colours live in src/world/theme.js → portals.colors, per theme)
 *   position  [x, z] on the island (see src/world/layout.js for the map),
 *             or [x, y, z] to set the height yourself
 *   rotation  which way the portal faces, in degrees (0 = toward the front of the island)
 *   size      optional scale, default 1
 *   triggerRadius  optional: how close (world units) you walk before the card opens
 *   locked    optional: { title, body } shown until every easter egg is found; meanwhile the
 *             portal looks dull and padlocked, and it bursts back to life when the last egg is found
 */

export const PORTALS = [
  {
    id: 'about',
    title: 'Welcome traveler.',
    layout: 'note', // just a few bold lines: the title reads as the first of them
    body: `
      <p>feel free to explore around.</p>
      <p>there are secrets to be uncovered, and treasures to be unlocked.</p>`,
    shape: 'gate',
    position: [0.412, -4.844],
    rotation: 90,
  },
  {
    id: 'music',
    title: 'Music',
    layout: 'music', // photo beside the title, two songs, a clip; it scrolls when it doesn't fit
    body: `
      <img class="music-photo" src="/music/guitar.png" width="257" height="339" alt="Seb playing a green electric guitar on stage" />
      <p class="music-intro">I’m a self taught guitarist, jazz pianist, and songwriter/arranger.</p>
      <p class="music-intro">Currently really digging retro<br /><span class="keep">J-Pop/Indo-Pop,</span> here’s a few stuff that I’ve been working on:</p>
      <div class="music-work">
        <div class="music-tracks">
          <button data-track="/music/mix1.mp3">mix 1</button>
          <button data-track="/music/mix2.mp3">mix 2</button>
        </div>
        <img class="music-daw" src="/music/arrangement.jpg" width="1197" height="550"
          alt="One of the arrangements open in a DAW: strings, drums, bass, guitars, keys, synths and stacked vocals" />
      </div>
      <p class="music-note">sometimes i still mess up, a lot!</p>
      <div class="music-clip">
        <svg class="music-arrow" viewBox="0 0 78 108" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M16 4c-2 14-5 34-3 52 2 17 12 30 30 34 9 2 19 1 28-2" />
          <path d="M59 76l13 12-14 10" />
        </svg>
        <video data-clip data-ratio="478 / 850" src="/music/messup.mp4" poster="/music/messup.jpg" aria-label="the clip of Seb playing on stage"></video>
      </div>`,
    shape: 'ring',
    position: [-6.1, 0.7],
    rotation: 16,
  },
  {
    id: 'gallery',
    title: 'Gallery',
    // a scrolling collage: each <div class="g-row"> is a row; its pictures share the width and line
    // up at the same height (their width/height are the files' pixel sizes). Tap one to see it big.
    // data-ratio="…" crops a picture to another shape. The files are in public/gallery/.
    layout: 'gallery',
    body: `
        <p class="card-sub">pieces of miscellaneous pictures, quotes &amp; memes in an expanding collection</p>
        <div class="g-row">
          <img src="/gallery/01-kanye.jpg" width="967" height="1200" loading="lazy" decoding="async" alt="Kanye West with a recorder and the Dropout Bear, in a Japanese ad" />
          <img src="/gallery/03-ran.jpg" width="788" height="1200" loading="lazy" decoding="async" alt="The poster for Akira Kurosawa’s Ran" />
        </div>
        <div class="g-row">
          <img src="/gallery/02-bell-focus.jpg" width="1200" height="1046" loading="lazy" decoding="async" alt="Alexander Graham Bell: “Concentrate all your thoughts upon the work in hand. The Sun’s rays do not burn until brought to a focus”" />
        </div>
        <div class="g-row">
          <img src="/gallery/04-when-im-ready.jpg" width="735" height="566" loading="lazy" decoding="async" alt="A cartoon of a man growing old and turning into a skeleton, saying “When I’m ready I’ll start”" />
        </div>
        <div class="g-row">
          <img src="/gallery/05-third-monkey.jpg" width="625" height="680" loading="lazy" decoding="async" alt="A framed poster: “If you’re going to fight, fight like you’re the third monkey on the ramp to Noah’s Ark, and brother, it’s starting to rain”" />
        </div>
        <div class="g-row">
          <img src="/gallery/06-naval.jpg" width="1200" height="776" loading="lazy" decoding="async" alt="Naval: “Specific knowledge is knowledge that you cannot be trained for. If society can train you, it can train someone else, and replace you.”" />
        </div>
        <div class="g-row">
          <img src="/gallery/07-hope.jpg" width="959" height="675" loading="lazy" decoding="async" alt="A strongman being injected with a giant syringe of HOPE" />
          <img src="/gallery/09-dont-die-wondering.jpg" width="1076" height="1200" loading="lazy" decoding="async" alt="Graffiti being sprayed on a wall: “Don’t die wondering”" />
        </div>
        <div class="g-row">
          <img src="/gallery/08-hawthorne.jpg" width="1015" height="1200" loading="lazy" decoding="async" alt="Tony Soprano under a Hawthorne quote: “No man can wear one face to himself and another to the multitude without finally getting bewildered as to which may be true”" />
        </div>
        <div class="g-row">
          <img src="/gallery/11-dreamers-doers.jpg" width="735" height="804" loading="lazy" decoding="async" alt="A surfer riding a giant wave, labelled Doers, watched by a crowd on the shore, labelled Dreamers" />
        </div>
        <div class="g-row">
          <img src="/gallery/10-nasa-cow.jpg" width="1200" height="849" loading="lazy" decoding="async" alt="A NASA photo: a picture of a cow taped up beside a Space Shuttle window, with the Earth outside" />
          <img src="/gallery/14-red-beam.jpg" width="960" height="1200" loading="lazy" decoding="async" alt="A painting of a crowd bowing, with one figure standing up into a red beam of light" />
        </div>
        <div class="g-row">
          <img src="/gallery/13-the-passenger.jpg" width="1200" height="379" loading="lazy" decoding="async" alt="From The Passenger: “You would give up your dreams in order to escape your nightmares and I would not. I think it’s a bad bargain.”" />
        </div>
        <div class="g-row">
          <img src="/gallery/12-one-life.jpg" width="572" height="536" loading="lazy" decoding="async" alt="Pepe hoisting a giant sword: “one life, its worth an attempt”" />
        </div>
        <div class="g-row">
          <img src="/gallery/15-genius-childlike.jpg" width="879" height="667" loading="lazy" decoding="async" alt="A book page: “The genius is childlike. Like children he looks into the world as into a new creation and finds there a perennial source of wonder and delight…”" />
        </div>
        <div class="g-row">
          <img src="/gallery/16-rocket.jpg" width="1200" height="1200" loading="lazy" decoding="async" data-ratio="0.62" style="object-position: 47% 50%" alt="A rocket launching" />
          <img src="/gallery/17-ship-harbor.jpg" width="1200" height="787" loading="lazy" decoding="async" alt="A cartoon of boats: “A ship in the harbor is safe, but that is not what ships are built for.”" />
        </div>
        <div class="g-row">
          <img src="/gallery/18-chosen-one.jpg" width="1182" height="1200" loading="lazy" decoding="async" alt="A newspaper clipping: “The Chosen One? American sensation Marty Mauser set for British Open showdown”" />
        </div>
        <div class="g-row">
          <img src="/gallery/19-sixteen-hours.jpg" width="721" height="794" loading="lazy" decoding="async" alt="A framed tweet from Elon Musk: “Working 16 hours a day, 7 day’s a week, 52 week’s in year and people still calling me lucky”" />
        </div>
        <div class="g-row">
          <img src="/gallery/20-ghost-rider.jpg" width="736" height="613" loading="lazy" decoding="async" alt="A painting of a rider among ghosts in a misty graveyard" />
          <img src="/gallery/21-daniel-lions.jpg" width="894" height="596" loading="lazy" decoding="async" alt="Daniel in the Lions’ Den, by Briton Rivière" />
        </div>`,
    shape: 'frame',
    position: [2.319, -14.28],
    rotation: 0,
    // until a visitor has found every easter egg, the card shows this instead, and the frame
    // stays dull with a padlock on it ({eggs} = how many eggs there are)
    locked: {
      title: 'Gallery',
      body: `
        <img class="locked-lock" src="/images/portals/lock.svg" width="230" height="270" alt="A padlock" />
        <p class="locked-note">find all {eggs} easter eggs to unlock :)</p>`,
    },
  },
  {
    id: 'joking',
    title: '“Surely You’re Joking, Mr Seb!”',
    layout: 'stories', // a long read: the card keeps its size and scrolls
    body: `
      <p class="stories-sub">mini collection of barely interesting stories</p>

      <h3>“Burning the boats”</h3>
      <p>To make sure I really focused on getting the scholarship that brought me to Singapore, I decided to burn the boats and drop out of school early. This meant that I would have to restart another 2 years to get my diploma, had I failed to win the scholarship. Now, it’s just funny to see people’s reactions when I bring up the fact that I can technically call myself a high school dropout.</p>

      <h3>“Toilet breaks”</h3>
      <p>In my first month as an international student in Singapore (they call us “scholars”, which is a term I never found fitting for myself), I got into a lot of trouble for attendance. I made a point to score high in exams, but I still found a lot of the classes to be regurgitative and uninteresting. At that time I was working as a creative director managing 300+ individual creators spanning several campaigns, and I really wanted to do a good job. Because of timezone differences, the best time to meet with these creators was exactly during school hours.</p>
      <p>What I would do then, for the next few weeks, was to study up all the material I knew we’d be going through in tomorrow’s class the night before. During class, I’d be able to take the calls during my “toilet breaks”. After this happened a few times, when I returned to class a teacher would try to trip me up with a question to highlight how I’m not paying enough attention, but because I made sure to revise the content they never really pestered me too much. I did this less and less as the year went on and the classes started to be a lot more interesting (and when I started to struggle to keep up with studying the night before!).</p>

      <h3>“Pickle rick and the istana gig”</h3>
      <p>I started taking guitar a bit more seriously when I arrived in Singapore, and it became a lot more fun when I was picked up by the main school band to play lead guitar. One week, news started spreading that a well-respected teacher was going to resign from the boarding school, and we wanted to give him a special tribute in our next gig in front of the whole hall. He was well respected because he was a jokester, the kind of teacher that knew how to pull pranks, and he was very openly a Rick and Morty fan. At the end of our performance, as we said our tributes to the teacher, in unison we pulled down our trousers to reveal that we were all wearing the same pickle rick motif boxers. It was stupid, childish, and funny to look back on.
        <img class="stories-photo" src="/stories/pickle-rick.jpg" width="900" height="617"
          alt="The band on stage with their trousers down, all in matching Pickle Rick boxers" />
        What we didn’t realize at the time was that among the audience were guests of honour, that included the board of several of the top schools in Singapore, alongside some higher ups that very well had the authority to take away scholarship privileges! We were all given stern reprimands and conduct slips, but it wasn’t all sour as after all it was done, our music teacher told us that we’re still selected to perform in the presidential palace (Istana) for an upcoming gig. It certainly wasn’t news you’d expect after embarrassing your whole band like that. I would be one of only two non-Singaporean migrants to perform in the palace lawn, and I made sure I brought a tight belt.</p>`,
    shape: 'bubble',
    position: [9.75, -8.7],
    rotation: 8,
  },
  {
    id: 'thoughts',
    title: 'Return?',
    layout: 'return', // the way back to the plain home page, in its own plain-HTML link style
    // "Home" goes to href="/": the front page of whichever site the playhub is on. If your home
    // page lives at another address, put that in its place (e.g. href="https://example.com/").
    body: `
      <p class="return-home"><a href="/">Home</a></p>`,
    socials: [
      { icon: 'instagram', url: 'https://www.instagram.com/seb.e.kho/', label: 'Instagram (@seb.e.kho)' },
      { icon: 'email', url: 'mailto:seb.em.kho@gmail.com', label: 'Email Seb' },
    ],
    shape: 'cloud',
    position: [-8.318, -11.875],
    rotation: 90,
  },
  {
    id: 'easterEgg',
    title: 'EASTER EGG',
    layout: 'quote',
    body: `
      <blockquote>
        <p>“At this time in your life, you know fewer limits, fewer taboos, and fewer fears than you ever will in the future. So do not squander your ignorance! Go out and do what your teachers and parents thought could not be done, and what they never thought of doing”</p>
        <cite>-peter thiel</cite>
      </blockquote>`,
    shape: 'egg',
    // hidden behind the island, on the sand at the foot of the summit's back wall
    position: [-4.7, -15.7],
    rotation: 180, // its sparkles drift away from the wall
    triggerRadius: 1.3, // it's small, so you walk right up to it
  },
  {
    id: 'easterEgg2',
    title: 'EASTER EGG',
    layout: 'quote',
    body: `
      <blockquote>
        <p>“the world is a very malleable place. if you know what you want, and you go for it with maximum energy and drive and passion, the world will often reconfigure itself around you much more quickly and easily than you would think”</p>
        <cite>-marc andreessen</cite>
      </blockquote>`,
    shape: 'egg',
    // tucked in the nook between the tallest helix and the big round rock (reach it from behind the rocks)
    position: [-5.8, -4.89],
    rotation: 210, // its sparkles drift away from the rock
    triggerRadius: 1.3,
  },
  {
    id: 'easterEgg3',
    title: 'EASTER EGG',
    layout: 'quote',
    body: `
      <blockquote>
        <p>“Don’t undertake a project unless it is manifestly important and nearly impossible.”</p>
        <cite>-edwin land</cite>
      </blockquote>`,
    shape: 'egg',
    // behind the big round rock on the right, beside the gallery terrace (just clear of the gap
    // where the rock meets the terrace wall, which is too narrow to walk into)
    position: [6.1, -12.42],
    rotation: 213, // its sparkles drift away from the rock
    triggerRadius: 1.3,
  },
];
