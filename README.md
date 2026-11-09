# BeeStation

Turn phones into controllers for local multiplayer games on a Windows PC. BeeStation runs a Windows host and serves a touch controller to each phone over the local network; no separate phone app or account is required.

**Status: under development and user testing.** BeeStation is not yet considered ready for general multiplayer use. A session supports up to four players, including pending and reconnecting players; each game's actual player limit and controller compatibility still apply.

## Features

- Add installed games to a local library and choose a controller preset.
- Connect phones on the same network using a QR code, with host approval for each player.
- Send phone inputs through virtual Xbox or DualShock 4 controllers.
- Edit a game's default controller layout in Controller Studio and customize personal layouts on each phone.
- Import and export layout profiles, pause all input, or end the session from the PC.

The desktop and phone interface is currently in Indonesian.

## Requirements and availability

- Windows x64 and Microsoft Edge WebView2 Runtime.
- The official ViGEmBus 1.22.0 driver for virtual controllers. ViGEmBus is end-of-life; see [prerequisites](docs/PRASYARAT.md) for details.
- A PC and phones on the same trusted local network.

The repository currently contains source code. A downloadable installer or portable release has not yet been published to GitHub Releases.

## Getting started

1. Build the application using the instructions below, then open `BeeStation.exe` from the complete release folder. Keep the `wwwroot` folder and accompanying files together.
2. Select **Tambah game** (Add game), choose an installed game or shortcut, and select a controller preset and Xbox or DS4 output. Steam and Epic discovery helps locate installations but does not automatically import your entire library.
3. In **Games**, select a poster with the mouse wheel or arrow keys. Hold the selected card, Enter, or Space to open its session page.
4. Select **Siapkan sesi** (Prepare session). The QR code appears when a local network address is available.
5. On each phone, scan the QR code, enter a name, and wait for the host to approve the request. Check the player's input on the PC before launching the game.
6. Select **Buka game** (Open game), then follow the game's own procedure for joining. Game-specific button mappings and multiplayer support must be verified in the game.
7. Use **Hentikan semua input** to neutralize and hold input, or **Akhiri sesi** to release BeeStation's virtual controllers and revoke session tokens.

If phones cannot connect, **Pengaturan → Izinkan akses HP di Windows** requests a Windows firewall rule for the BeeStation executable, the active host TCP port, and the local subnet. Both Windows Public and Private network profiles are supported; changing the network category is not required.

## Controller Studio and layouts

Controller Studio on the PC edits a game's **default** layout. You can arrange controls, adjust their size and mappings, set analog and D-pad behavior, and preview the phone layout. The preview does not send game input.

Players can also edit and save their own layouts on their phones. Changing the PC default does not overwrite an existing personal layout. To adopt the latest game default, choose **Edit layout → Gunakan default game → Simpan** on the phone. Layout profiles can be imported and exported as JSON.

The General preset supports an optional camera gesture: swipe an empty area on the right side of the phone controller to send right-stick input. Buttons and manual sticks keep priority. The gesture can be enabled or disabled per layout; the Dungeons preset does not enable it by default because its right stick is used for directional rolling.

## Local data and network

BeeStation stores its library and personal layouts under `%LOCALAPPDATA%\BeeHooks`; the older folder name is retained for compatibility. Removing a game from the BeeStation library does not delete its installation or save files. Keep a backup of personal data before removing it.

The desktop administration endpoint is restricted to the local PC. Phones connect over the LAN using session tokens and host approval. Local HTTP and WebSocket traffic is **not encrypted**, so use a trusted network and do not expose the host to the internet. Inputs are neutralized on disconnect or when the controller page is hidden; real-world Wi-Fi and device behavior still need testing.

## Build from source

The project uses C#/.NET for the Windows host and virtual controllers, WPF with WebView2 for the desktop window, and TypeScript, HTML, CSS, and Vite for the interface.

Use Node.js 24 and the .NET SDK version specified in `global.json` on Windows. UI and NuGet dependencies are pinned by their lockfiles.

```powershell
.\build.ps1
```

The script installs the locked UI dependencies, builds the UI, runs the logic checks, and publishes a self-contained Windows release to `release/BeeStation-win-x64`. After successful packaging, it creates or updates the **BeeStation** shortcut on the current user's Desktop. The application still requires WebView2 Runtime and the virtual controller driver described above.

For development, build the UI first and then run `dotnet run --project src/BeeHooks.App`. No development server is required.

## Testing

Run the logic checks:

```powershell
dotnet run --project tests/BeeHooks.Checks
```

Browser checks use an isolated host and a fake controller driver:

```powershell
dotnet run --project tests/BeeHooks.Checks -- --serve-test
# In another terminal, use the address printed by the host:
$env:BEEHOOKS_TEST_URL='http://127.0.0.1:PORT'
cd ui
node tests/desktop.mjs
node tests/smoke.mjs
node tests/studio.mjs
```

These checks do not establish compatibility with physical phones, drivers, or games. The optional `--probe` checks create real virtual devices; close games first if you do not want their controller slots affected.

## Contributing

Issues and pull requests are welcome. Describe the change or problem, the Windows version, and the steps needed to reproduce it. Remove pairing codes, session tokens, and personal paths from reports. Opening a pull request proposes a change; maintainers review it before it is merged.

## License

BeeStation's own code is available under the [MIT License](LICENSE). Third-party components retain their respective licenses; see the notices in `docs/` and `ui/public/fonts/`.
