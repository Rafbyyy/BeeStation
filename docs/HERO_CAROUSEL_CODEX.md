# BeeStation Hero Carousel: adapted Codex brief

Source reference: https://21st.dev/@crafterui/components/hero-carousel
Public runtime evidence: evidence/hero-carousel-rea.json
This brief was written from the public preview and the user's BeeStation requirements. The site's original Copy prompt was not retrieved.

## Implementation brief

Work in the existing BeeStation TypeScript/CSS/Vite and .NET/WPF application. Preserve its session, driver, media and persistence APIs. Do not migrate to React or add animation dependencies.

Replace the perspective gallery with a full-screen game selection scene. Use a quiet charcoal/off-white/honey palette and the locally bundled fonts. Place one large game title, restrained metadata and the Siapkan sesi/Buka game actions above a filmstrip. Put game editing/removal under Kelola game. Keep the bee identity and the existing main navigation.

Give all filmstrip cards one top edge and equal widths. Expand only the selected card downward to approximately twice the neighboring cards' height. Preserve DOM nodes across changes so transitions connect. Support clicks, horizontal drags/swipes, scoped wheel selection and Left/Right/Home/End. Keep page scrolling outside the strip and on vertical touch pans. Respect reduced motion, browser zoom and visible keyboard focus. Never start sessions or launch games from selection alone.

Retain the selected game's official Steam trailer as the background, including existing 1080p cache, audio/mute/pause controls, fallback cover, offline behavior and stale-response handling. Do not replace it with external demo media. Keep a working initial empty state and initials for missing covers.

Place the session QR, LAN address and player cards below the selection scene. Siapkan sesi should create the session through the existing API and then reveal that section. Maintain at most four players and preserve the active QR's scan size.

Controller Studio remains game-default-only. Preserve personal HP layouts and named presets; adopting the new default requires Reset and Save on that HP. Group D-pad (joined/split/off), left analog and right analog (free/eight-way/off), plus action-button enable switches. Eight-way direction snapping must retain magnitude, sensitivity and dead zone.

Validate in an isolated fake-driver host: library selection and correct action target, keyboard/mouse/touch, responsive viewports, reduced motion, trailer/audio switching, Studio default-vs-personal persistence and input neutrality while editing. Do not write test records into the real library. After successful build and packaging, update and read back the existing Desktop BeeStation shortcut.
