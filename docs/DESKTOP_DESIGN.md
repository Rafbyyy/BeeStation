# BeeStation desktop gallery

## Current flow: Games and session details

Games is now a dedicated viewport-sized poster gallery. Wheel selects games throughout the scene, while double-click or keyboard Enter opens a separate game/session page through a 320 ms fade/slide/scale transition. Back returns to the gallery without ending a session. Other-game pages show an explicit active-session notice instead of another game's QR. Session setup and launching remain explicit actions. Dialogs, zoom gestures and detail-page scrolling retain their own input behavior.

The PC background is restored to the earlier AAYUSH duhan Halftone Trail adaptation after the user rejected Dotted Grid. The user requested only a slightly wider trail: multiply the original hover/pressed brush radii by 1.1. Preserve the 10 px cell spacing, dot size, opacity, transparent trailer layering, reduced-motion behavior and idle/hidden-page cleanup. Trail fade is now about twice as fast: decay .925 per 16.67 ms instead of .965, settling within about one second. The canvas never captures input. Phone/controller UI is unchanged. Dotted Grid notes below are historical.

The following sections retain earlier design decisions and evidence; this flow supersedes gallery/session-on-one-page and kinetic-grid references.

## Current session room (8 November 2026)

The user's annotated sketch guides composition rather than literal colored boxes. Use full PC content width: large vertical game art and title/action tiles on the left; approved team beneath; a reserved Nova QR panel at upper right and a distinct approval queue beneath. Session creation and Play remain explicit, independent actions. The QR is always visible during a session without a reveal/hide control or pointer/keyboard dismissal. The real 208 px canvas, LAN selector and invite remain unchanged. Pending names never appear among ready players until approval. Approval/rejection/removal reuse existing endpoints. Membership-only rendering preserves keyboard focus during 500 ms polling; live status/readouts update in place. Narrow PC windows reflow naturally with scrolling, rather than clipping controls.

## Current gallery: Hero Carousel (8 November 2026)

The user replaced the earlier perspective-gallery direction with Crafter UI's [Hero Carousel](https://21st.dev/@crafterui/components/hero-carousel). The selected card grows down from a shared top edge; the other cards stay at about half height. Large game type and a full-screen trailer backdrop lead the first screen. The session QR and player checks sit below it. The older perspective-gallery notes below are historical.

REA CLI 6.4.0 ran a bounded public browser scenario against the preview URL linked by 21st.dev. Evidence: `ev_6ec7cba2f36ab0adeb407b4e7b2438d95d28a23a64303afbe65cd87d84a5b7c9`, retained in `evidence/hero-carousel-rea.json`; scenario in `evidence/hero-carousel-scenario.json`. All three actions completed: wait, click Neon Uplight, wait. The title/counter and expanded card changed in the captured public preview. Reference screenshots are retained next to the evidence. Demo image assets failed to load during this capture, so it proves composition/selection, not a complete color or artwork match. No gated source, prompt or account content was accessed; the component page lists MIT licensing. BeeStation's implementation is original TypeScript/CSS and reuses its own game artwork and Steam trailer cache.

Implementation decisions:

- Stable card nodes; equal widths, shared top edge, active card height about 1.92 times its neighbors. CSS transitions take 440 ms; reduced motion removes them.
- Click, scoped wheel, pointer drag, touch swipe and Left/Right/Home/End. Wheel is limited to the strip, yields page scrolling at the ends, and retains browser zoom gestures. Vertical touch pans retain page scrolling. No automatic selection timer.
- One card tab stop, visible keyboard focus, accessible game names and polite index announcements. Long titles and coverless/failed-image initials remain supported.
- A compact first screen with game actions and a filmstrip. A player link and session setup lead to the QR below; QR remains at least 208 px. Game editing/removal is under Kelola game.
- Existing 1080p official trailer lookup/cache, audio at 30%, mute, pause, looping, hidden-page handling and stale-response protection remain. Full-screen video stays unblurred. User game records, profiles and phone layout positions are not rewritten by this design.
- The previous Fold Toolbar attachment was withdrawn and is not used. The adapted Codex brief is in `docs/HERO_CAROUSEL_CODEX.md`; it was written locally from public observations rather than copied from the gated prompt.

## Historical references and evidence

- Font reference: https://maxibestof.one/typefaces/display-fonts. Oswald is listed under free display fonts. The variable 200–700 font is bundled locally with its SIL OFL license; headings use 400, body and controls retain Segoe UI.
- Gallery reference: https://mathiasadolfsson.dev/. Observed composition: a large central project frame, angled side frames, dark surroundings and a separate navigation/caption area. The reference renders through a Three.js canvas. BeeStation uses CSS perspective and transforms for the requested gallery behavior; reference assets and code were not copied.
- REA browser observation: `ev_0187ba716526f6429b77593fdcc65e79edd990b5715b51edfb38af8548738055`, retained in `evidence/desktop-reference-rea.json`. This is browser evidence, not analysis of a PlayStation console or the reference's complete source.

## Historical gallery decisions

- Keep the bee logo, honey accent, Indonesian labels and existing session workflow.
- The bee mark was simplified at the user's request: a striped honey-colored body and small stinger on a charcoal tile, without wings. `ui/public/favicon.svg` is the vector source; the PNG and seven-size Windows ICO are rendered from it. Web, native-window and Desktop shortcut use the same mark. The packaged shortcut icon filename includes its content hash so Windows sees a new icon path when the mark changes.
- Use a charcoal ground, off-white foreground and muted slate secondary text. Primitive colors feed surface/foreground tokens; card radius and gallery timing are shared component values in `ui/src/desktop.css`.
- A selected game occupies the center. Adjacent cards recede in perspective. Selecting a game updates the details and optional cover backdrop while preserving card DOM nodes for continuous motion.
- Click a visible card or use previous/next buttons. The focused card supports Left/Right, Home and End; selection does not start a session or launch a game. There is one tab stop in the card collection, selected state uses `aria-pressed`, and the counter is announced politely.
- Movement takes 420 ms and stops under reduced motion. No automatic rotation, scroll capture, WebGL runtime, new framework or animation dependency is needed.
- A coverless game has a styled initials fallback. Only games in the user's library appear. Multi-game screenshots are explicitly simulations from an isolated test host.
- During an active session, QR remains 208×208 px. Session, profile, launcher and phone-controller APIs retain their existing behavior.

## Artwork, motion and phone refresh

- Steam entries resolve local hero/header artwork from Steam's library cache into BeeStation's `covers` cache. An explicitly chosen cover takes precedence. The derived `artwork` status field leaves the stored `cover`, game collection and profiles untouched. Failed images reveal the existing initials fallback.
- Selecting a Steam game requests an official Steam trailer preview. Current DASH trailers target 1080p video and six fragments (about 18 seconds for the two installed games). A new `-1080.mp4` cache filename avoids reusing older 480p clips. Matching AAC audio is cached separately as `-audio.m4a` and requested asynchronously so missing audio cannot delay cached video. Older progressive MP4 trailers retain their inline soundtrack. Downloads have a 48 MB limit and a 45-second timeout per track; only official HTTPS Steam media hosts are accepted. Successful media is cached atomically for later offline playback. Unavailable media leaves the image backdrop.
- Following user feedback that the original blur/dimming hid the footage, the video backdrop is unblurred at full opacity. Directional dark gradients protect text while retaining recognizable scenes. The fallback image retains a light 8 px blur. Reduced motion starts with playback paused. Selection responses are checked against the current game so an earlier response cannot replace the current backdrop.
- Sound starts after choosing a game or pressing the labeled speaker control. Trailer volume is 30%; a 120 ms sine sweep gives selection feedback for clicks and keyboard navigation. The speaker button mutes only the trailer; navigation effects remain enabled after user interaction. repeated selection of the same game and status refreshes produce no sound. No sound library or downloaded effect asset is needed. Native WebView2 no longer globally mutes the page. Playback, seek, looping, page visibility and game changes also control the separate soundtrack; drift over 300 ms is corrected against the video clock. The previous media elements are paused and unloaded before replacement.
- Phone controls now use smooth circular geometry and locally bundled Manrope, selected from https://maxibestof.one/typefaces/manrope. The SIL OFL license ships with the font. A/B/X/Y retain green/red/blue/yellow and show their controller letters even in older Overcooked profiles. Presentation changes do not reset saved positions, sizes, mappings or browser identity.
- `evidence/video-background-checks.json` records simulated muted playback, observed 17.98-second looping, blur, pause/resume, reduced motion and video switching. Both installed games' actual cached clips were also decoded in Chrome. The complete fake-driver browser suite covers legacy Overcooked labels and unchanged saved layout data. Physical phones and live gameplay were not retested for this visual refresh.
- The newer `ui/tests/audio.mjs` and `evidence/audio-browser-checks.json` cover actual 1080p decoding, non-silent decoded AAC samples, measured selection-effect output, pause/resume, loop synchronization, mute across selections, keyboard feedback, retired media, quiet status updates, hidden-page/reduced-motion pauses and video failure. Automated audio tests mute Chrome's physical output; speaker listening is a separate check.

## Skill applications

- UI/UX Pro Max: spatial navigation, focus, state clarity, reduced motion, font loading, responsive checks. Generic purple/esports and landing-page suggestions were not used because the supplied references and BeeStation identity determine the design.
- Taste Skill: coherent visual hierarchy, actual product content and browser screenshot review. Website marketing sections and generated photographs do not apply to this desktop launcher.
- Design System / UI Styling / Brand: shared CSS tokens, native semantic controls, consistent spacing, logo and honey accent. The existing TypeScript/CSS stack is retained.
- Ponytail: reuse session and library handling; avoid a new carousel or rendering dependency.

## Verification

The current desktop suite additionally checks the shared card top edge, active height ratio, wheel/mouse drag and canceled gestures, emulated touch swipe versus vertical page pan, session setup and preserved card nodes. The Studio suite checks default-only authorization, preservation of personal layouts/named copies, explicit HP Reset/Save/Cancel, grouped control models, eight-way input snapping for both sticks including off-axis gestures, and atomic rejection at the 32-control limit.


`ui/tests/desktop.mjs` checks empty state, font, selection and focus, long escaped titles, correct edit/session target, QR size, tab persistence, reduced motion, preserved card nodes and responsive layout at 1920, 1280, 960 and 390 px. Existing `ui/tests/smoke.mjs` checks the complete fake-driver session/controller workflow. Neither test launches a real game or proves game compatibility.

## Navigation kinetic grid

The supplied KineticGrid is adapted to the existing TypeScript canvas stack and scoped to the three desktop navigation buttons. Honey lines/nodes warp subtly around the pointer and click ripples last 750 ms. No opaque page background or new framework is introduced. Rendering settles to idle, stops while hidden, and respects reduced motion; canvas is pointer-transparent and aria-hidden. Desktop tests exercise pixels during hover/click and after settling, keyboard activation, canvas bounds and reduced motion. Card artwork now sizes to each card rather than the expanded-card height, avoiding top-only crops in collapsed cards.

## Current background and application icons

The latest user request supersedes the navigation-only grid: the transparent kinetic canvas now fills the viewport above the trailer and behind page content. Grid spacing and opacity are scaled down for readability. The filmstrip uses complete application icons with contain rather than cropped cover artwork. Steam registry ICOs are restricted to the local Steam games icon directory; square library-cache icons are fallback. Local exe/lnk icons use the Windows shell without launching targets. PNG cache files are separate from cover/profile data; missing icons show initials.

## Current refinement: 32 px grid and vertical game posters

The grid now has roughly 32 px cells, balanced 18 px pointer warp, clearer active lines and synchronized ripple radius. The user then replaced icon tiles with full vertical game posters. Steam library_600x900 art uses an independent -poster cache, with image-orientation validation and existing byte/dimension limits. Equal-height 2:3 cards show posters with contain; selection uses border/opacity. Artwork, icon, trailer and personal-layout caches are not overwritten. Icons/initials remain a fallback when no poster/custom cover exists.

## Vercel-style navigation

Reference: https://21st.dev/@yadwinder/components/vercel-tabs (Yadwinder Singh, MIT as listed on the page). Observed public preview https://cdn.21st.dev/bundled/1597.html; screenshot evidence/vercel-tabs-reference.png. BeeStation uses an original vanilla TypeScript/CSS implementation with one sliding underline and a separate hover highlight. It measures actual button widths, realigns after resize/font loading, retains 44 px targets, exposes aria-current, and respects reduced motion. Keyboard focus moves separately from activation. Existing Studio draft guards run before selection changes. No React migration, new dependency or gated component source retrieval.

## Desktop Nova QR control

Reference: https://21st.dev/@ruixen.ui/components/nova-qrbutton; public preview https://cdn.21st.dev/ruixen.ui/nova-qrbutton/default/bundle.1749228409360.html?theme=light. BeeStation adapts the round glowing trigger and gradient popup in original TypeScript/CSS, using its existing qrcode encoder and real session/adapter URL. The 208 px black-and-white code and four-module quiet zone remain unscaled; glow sits outside it. Hover/focus preview, click pinning, outside/Escape/focus dismissal, viewport-aware placement, reduced motion and cleanup are covered by ui/tests/qr.mjs. QR is a PC control; phone UI changes are explicitly deferred.


## Gallery wordmark footer (8 November 2026)

The user supplied Halftone Wordmark Footer source and requested BeeStation as its wordmark. Adapt the supplied coverage mask, spring displacement, warm tint and click shock ring to the existing TypeScript/Canvas stack; no React/shadcn/Tailwind migration. Retain only relevant app copy, without the demo studio/contact links. Scope the footer to the game gallery and fit it inside the viewport, preserving vertical posters and the game-selection wheel, including over the footer. Crop the large word at the lower edge as in the supplied reference. Accessible text accompanies the decorative canvas. Resize/font readiness rebuild the mask; reduced motion renders a static wordmark; observers and visibility checks suspend animation offscreen/hidden, and listeners/frames are disposed on pagehide.


## Native fullscreen and honeycomb identity (8 November 2026)

A header control and F11 toggle WPF borderless maximized mode. Escape exits and the previous WindowState, WindowStyle and ResizeMode return; normal bounds remain managed by WPF. Native accelerator forwarding supplies the window PreviewKeyDown handler, filtering repeat/modifier keys. WebView messages are restricted to the desktop root/index on the current local host and two exact strings (state/toggle). The header observes native state; a standalone browser falls back to the standard Fullscreen API. Fullscreen does not create/end a session or modify Studio drafts.

The current mark is three connected hexagonal honeycomb cells in #f5c451 on #0c1016, with rounded joins for clarity at small sizes. Canonical vector: ui/public/favicon.svg. node ui/scripts/buildIcon.mjs renders beestation.png at 512 px and a multi-resolution ICO at 16/24/32/48/64/128/256. The Windows app resource and hashed shortcut icon are updated together.


Fullscreen footer sizing: the user chose a taller footer over smaller type. Its height follows the viewport width (12vw + 48px, minimum 136px), with the former 260px maximum removed. The wordmark keeps its full-width type size; only the intended bottom crop remains. Tests include 2560x1440 and clear pixels above the upper letter edges, while preserving the no-scroll gallery.


Current gallery title: remove the double-click/Enter instruction under the selected name. Increase the display title to 38–68 px, line-height 1.18, and bottom padding .12em, with natural wrapping and visible overflow so descenders such as g remain complete. Empty-library help stays. The header speaker controls trailer audio only; navigation effects retain their own AudioContext and remain audible with the trailer muted.
