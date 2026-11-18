# Publishing to itch.io

The browser build runs on itch.io as an HTML5 game. This file covers how to
build it, how to set up the itch page, and what to settle before going public.

## 1. Build the package

```powershell
npm run build:itch
```

This writes `releases\pixel-soccer-league-<version>-web.zip`, with `index.html`
at the root of the zip. The build:

- uses a relative base (`./`), because itch serves the game from a random CDN
  subpath (`html-classic.itch.zone/html/<id>/`);
- sets `PSL_WEB_BUILD=1`, which turns off the dev-server tooling (the
  `/__db`, `/__tuning` and `/__telemetry` calls, plus the MATCHES, ANIMATIONS
  and TELEMETRY tabs). Without it, every match would send requests to itch's CDN;
- leaves out `public/` files the game never loads (the MLS crests, unused sound
  takes, source art and the offline model weights). The script refuses to drop
  anything `src/` still references;
- checks itch's limits: at most 1000 files, 500 MB in total and 200 MB per file.
  The 0.9.3 package is 82 files, 4.9 MB zipped.

`npm run build:itch -- --no-zip` builds and checks without zipping. The
unzipped build is in `dist-itch\`.

## 2. Upload

**In the browser.** Create a project at <https://itch.io/game/new>, set
**Kind of project** to **HTML**, upload the zip, and tick
**This file will be played in the browser**.

**With butler** (itch's command-line uploader, <https://itch.io/docs/butler/>):

```powershell
butler push releases\pixel-soccer-league-0.9.3-web.zip <your-itch-user>/<game-slug>:html5 --userversion 0.9.3
```

Do the first upload in the browser so the project and its HTML5 settings exist.
After that, `butler push` replaces the build in place.

## 3. Embed settings (Edit game → Embed options)

| Setting | Value | Why |
| --- | --- | --- |
| Embed in page → Viewport dimensions | **1280 × 720** | The game fills its frame; 16:9 matches the pitch camera. |
| Fullscreen button | **On** | The in-game fullscreen option is desktop-only. In the browser, itch's button is the way to go fullscreen. |
| Mobile friendly | **Off** | Keyboard or gamepad only. There are no touch controls. |
| Automatically start on page load | **Off** | The audio needs a click first anyway, and the splash says "press any button". |
| SharedArrayBuffer support | **Off** | Not used. |
| Scrollbars | **Off** | Arrow keys and Space no longer scroll the host page, but scrollbars would still show. |

## 4. Page details (draft, edit freely)

- **Title:** Pixel Soccer League
- **Classification:** Games
- **Genre:** Sports
- **Tags:** soccer, football, pixel-art, retro, local-multiplayer, 2-player,
  sports, arcade, world-cup
- **Inputs:** Keyboard, Xbox controller, Playstation controller
- **Multiplayer:** Local multiplayer (2 players, one keyboard or two gamepads)

**Short description**

> Retro pixel soccer: World Cup mode, hot-seat two-player and CPU matches.

**Controls** (for the description)

| | Player 1 (home) | Player 2 (away, hot seat) |
| --- | --- | --- |
| Move | W A S D | Arrow keys |
| Sprint | Left Shift | Right Shift |
| Pass (hold to charge) | Space / G | , |
| Shoot (hold to charge) | F | . |
| Lob / chip | C | ; |
| Tackle | R | / |
| Switch player | Q / E, V for nearest | [ / ], ' for nearest |
| Set-piece routines | 1 – 4 | Numpad 1 – 4 |
| Options | Esc | |

Gamepads are supported, and two pads can play hot seat.

**Screenshots and cover.** The itch cover is 630 × 500 and the screenshots
should be 16:9. `public/assets/Pixel Soccer League2.png` (the splash logo) and
`public/assets/menu.png` are good starting art.

## 5. Settle before setting the page public

These come from the red-team pass. None of them break the build. They are
calls only you can make.

- **Font licence.** `SubwayTicker` (`public/assets/fonts/`, used for the
  stadium ticker) says "Freeware, Non-Commercial". A paid game, or possibly one
  that accepts donations, needs K-Type's commercial licence or a replacement font.
- **Real names and marks.** Team selection uses the real names of the MLS clubs.
  World Cup mode uses "FIFA World Cup 2026" naming, the splash logo says
  "2026 World Cup Edition", and national flags are shown. The crests are not
  shipped. `src/mlsRatings.ts`, with real players, is not in the bundle.
- **Generated audio.** The theme song (`Pixel Soccer League.mp3`) is a Suno
  track, and the announcer lines carry ElevenLabs C2PA manifests. Both
  services' commercial rights depend on the plan the audio was made under.
- **Release type.** If you want the page live while you decide, use
  **Restricted** (playable by link only) or **Draft**.

## Storage on itch

itch serves every HTML game from one shared origin, and in some browsers
(Safari, private windows) iframe storage is partitioned or blocked. The web
build:

- keeps telemetry for only the last 5 matches, plus the one in progress
  (`pruneTelemetrySessions` in `src/telemetry/recorder.ts`);
- keeps playing with telemetry off if IndexedDB is blocked or full;
- saves season and World Cup progress in `localStorage`. If storage is blocked,
  the game still plays, but that progress is not kept between visits.
