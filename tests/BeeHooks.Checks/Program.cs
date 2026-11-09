using BeeHooks;
using BeeHooks.Core;
using System.Text;
using System.Text.Json;

if (args.Contains("--watch-xinput"))
{
    var started = System.Diagnostics.Stopwatch.StartNew(); var last = new string[4];
    Console.WriteLine("Read-only Windows controller monitor, 30 seconds. LS is button mask 0040.");
    while (started.Elapsed < TimeSpan.FromSeconds(30))
    {
        for (uint i = 0; i < 4; i++)
        {
            var current = XInput.GetState(i, out var state) == 0 ? $"buttons={state.Buttons:X4} lx={state.LX} ly={state.LY} rt={state.RT}" : "disconnected";
            if (current != last[i]) { Console.WriteLine($"{started.ElapsedMilliseconds}ms slot={i} {current}"); last[i] = current; }
        }
        await Task.Delay(1);
    }
    return;
}
if (args.Contains("--xinput"))
{
    Console.WriteLine("XInput connected: " + string.Join(',', XInput.Connected()));
    return;
}
if (args.Contains("--serve-test"))
{
    Environment.SetEnvironmentVariable("BEEHOOKS_DATA", Path.Combine(Path.GetTempPath(), "BeeHooks-ui-" + Guid.NewGuid()));
    using var host = new Host(_ => new FakePad());
    await host.Start(); Console.WriteLine(host.AdminUrl);
    Console.WriteLine("FAKE DRIVER — browser tests only; no Windows/game proof.");
    using var cancellation = new CancellationTokenSource();
    Console.CancelKeyPress += (_, e) => { e.Cancel = true; cancellation.Cancel(); };
    try { await Task.Delay(TimeSpan.FromMinutes(40), cancellation.Token); } catch (OperationCanceledException) { }
    return;
}

if (args.Contains("--probe"))
{
    var before = XInput.Connected(); Console.WriteLine("XInput before: " + string.Join(',', before));
    var pads = new List<VirtualPad>();
    try
    {
        var kind = args.Contains("--ds4") ? "ds4" : "xbox";
        var count = args.Contains("--four") ? Session.MaxPlayers : 1;
        for (int i = 0; i < count; i++) { pads.Add(new(kind)); Console.WriteLine($"Created {kind} #{i + 1}"); }
        await Task.Delay(1000);
        Console.WriteLine("XInput after: " + string.Join(',', XInput.Connected()));
        if (kind == "xbox")
        {
            var added = XInput.Connected().Except(before).Single();
            pads[0].Apply(new(1, ["a"], .5, -.5)); await Task.Delay(100);
            XInput.GetState(added, out var state);
            Check((state.Buttons & 0x1000) != 0 && state.LX > 15000 && state.LY > 15000, "Windows XInput reads A and diagonal");
            pads[0].Apply(PadState.Neutral); await Task.Delay(100); XInput.GetState(added, out state);
            Check(state.Buttons == 0 && state.LX == 0 && state.LY == 0, "Windows neutral readback");
        }
        if (args.Contains("--interactive"))
        {
            Console.WriteLine("Commands: slot button lx ly milliseconds. Use '-' for no button; quit to release. Maximum 1000 ms.");
            string? line;
            while ((line = Console.ReadLine()) is not null && line != "quit")
            {
                try
                {
                    var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length != 5) throw new ArgumentException("Need 5 fields.");
                    int slot = int.Parse(parts[0]), ms = int.Parse(parts[4]);
                    if (slot < 0 || slot >= pads.Count || ms is < 1 or > 1000) throw new ArgumentException("Out of bounds.");
                    var input = new PadState(1, parts[1] == "-" ? [] : parts[1].Split(','), double.Parse(parts[2], System.Globalization.CultureInfo.InvariantCulture), double.Parse(parts[3], System.Globalization.CultureInfo.InvariantCulture)); input.Validate();
                    try { pads[slot].Apply(input); await Task.Delay(ms); } finally { pads[slot].Apply(PadState.Neutral); }
                    Console.WriteLine($"Applied slot {slot}, then neutral.");
                }
                catch (Exception e) when (e is ArgumentException or FormatException or OverflowException) { Console.WriteLine("Rejected: " + e.Message); }
            }
        }
        else if (args.Contains("--hold"))
        {
            Console.WriteLine("Holding neutral pads for 10 minutes; Ctrl+C releases. Use game test UI for interactive input.");
            await Task.Delay(TimeSpan.FromMinutes(10));
        }
    }
    finally { foreach (var pad in pads) pad.Dispose(); }
    await Task.Delay(1000);
    Console.WriteLine("XInput cleanup after settle: " + string.Join(',', XInput.Connected()));
    return;
}

int checks = 0;
void Ok(bool condition, string label) { Check(condition, label); checks++; }
void Reject(Action action, string label) { bool rejected = false; try { action(); } catch (ArgumentException) { rejected = true; } catch (JsonException) { rejected = true; } Ok(rejected, label); }
WindowChecks.Run(Ok);
Ok(Firewall.ValidatePorts("32100,32100,32101") == "32100,32101", "firewall ports stay explicit and deduplicated");
Reject(() => Firewall.ValidatePorts("*"), "firewall cannot open all ports");
Reject(() => Firewall.ValidatePorts("0,65536"), "firewall port bounds");
var lan = new LanAdapter("Test", "192.168.1.10", "255.255.255.0");
Ok(Network.SameSubnet(System.Net.IPAddress.Parse("192.168.1.20"), lan), "LAN neighbor accepted independent of profile category");
Ok(!Network.SameSubnet(System.Net.IPAddress.Parse("192.168.2.20"), lan), "other subnet rejected");
Reject(() => new PadState(0, ["unknown"]).Validate(), "unknown button");
Reject(() => new PadState(0, [], double.NaN).Validate(), "NaN axis");
Reject(() => new PadState(-1, []).Validate(), "negative sequence");
Reject(() => PadState.Parse(Encoding.UTF8.GetBytes("{\"seq\":1,\"buttons\":[],\"slot\":9}")), "client cannot choose slot");
Reject(() => PadState.Parse(new byte[2049]), "message size limit");
Reject(() => PadState.Parse(Encoding.UTF8.GetBytes("{\"seq\":1,\"buttons\":[]}")), "full state required");
foreach (var name in Presets.Names) { var layout = Presets.Get(name); layout.Validate(); Ok(Layout.Import(JsonSerializer.SerializeToUtf8Bytes(layout, JsonConfig.Options)).Name == name, "preset import " + name); }
Ok(Presets.Get("dungeons").Controls.Any(c => c.Mapping == "lt"), "Dungeons includes LT for chat wheel");
Ok(Presets.Get("dungeons").Controls.All(c => c.Id != "join"), "Dungeons adventure preset removes Join");
Ok(Presets.Get("dungeons").Controls.All(c => c.Id is not ("map" or "inventory")) && Presets.Get("dungeons").Controls.Single(c => c.Id == "dpad-up").Mapping == "up" && Presets.Get("dungeons").Controls.Single(c => c.Id == "dpad-down").Mapping == "down", "Dungeons uses D-pad for inventory/map without duplicate buttons");
Ok(new[] { ("face2", "x", "X"), ("face3", "y", "Y"), ("face1", "b", "B") }.All(item => Presets.Get("dungeons").Controls.Any(c => c.Id == item.Item1 && c.Mapping == item.Item2 && c.Label == item.Item3)), "Dungeons artifacts show X Y B in controller positions");
Ok(Presets.Get("umum").Controls.Any(c => c.Mapping == "lt"), "other presets retain LT");
Ok(Presets.Get("overcooked2").Controls.Where(c => new[] { "a", "b", "x", "y" }.Contains(c.Mapping)).All(c => c.Label == c.Mapping.ToUpperInvariant()), "Overcooked face buttons use A B X Y labels");
var curated = Presets.Get("dungeons");
Ok(curated.DeadZone == 0 && curated.Opacity == .9 && curated.FloatingStick && curated.Controls.Single(c => c.Id == "face0").Size == .19, "curated preset keeps user controls and restores requested opacity");
Ok(curated.Controls.Count(c => c.Id.StartsWith("dpad-")) == 4 && curated.Controls.Where(c => c.Id.StartsWith("dpad-")).All(c => c.X > curated.Controls.Single(c => c.Id == "stick").X), "small adventure D-pad sits to the right of the analog");
Ok(curated.Modes is null && curated.Controls.All(c => c.Id != "back"), "Dungeons has one layout and removes legacy Back");
Ok(new[] { "a", "b", "x", "y", "lb", "rb", "lt", "rt", "ls", "rs", "start", "up", "down", "left", "right", "leftStick", "rightStick" }.All(m => curated.Controls.Count(c => c.Mapping == m) == 1), "Dungeons exposes each requested controller input once");
var menuControl = curated.Controls.Single(c => c.Id == "start");
Ok(new[] { "ls", "rs", "lt" }.All(id => curated.Controls.Single(c => c.Id == id) is var c && c.X > menuControl.X && c.Y == menuControl.Y && c.Size == menuControl.Size), "LS, RS and LT align to the right of Menu at the same size");
var topRow = new[] { "start", "ls", "rs", "lt" }.Select(id => curated.Controls.Single(c => c.Id == id)).ToArray();
Ok(topRow.Zip(topRow.Skip(1)).All(pair => Math.Abs(pair.Second.X - pair.First.X - .08) < .000001), "Menu LS RS LT have equal wider gaps");
var disabled = curated with { Controls = curated.Controls.Select(c => c.Id == "face0" ? c with { Enabled = false } : c).ToArray() };
Ok(Presets.Get("umum").CameraSwipe == true && curated.CameraSwipe != true && Presets.Get("brawlhalla").CameraSwipe != true && Presets.Get("overcooked2").CameraSwipe != true, "camera swipe defaults to generic camera games without enabling Dungeons roll");
foreach (bool active in new[] { true, false }) Ok(Layout.Import(JsonSerializer.SerializeToUtf8Bytes(curated with { CameraSwipe = active }, JsonConfig.Options)).CameraSwipe == active, "camera swipe enabled/disabled survives layout export/import: " + active);
Ok(Layout.Import(Encoding.UTF8.GetBytes("{\"version\":1,\"name\":\"old\",\"controls\":[{\"id\":\"a\",\"label\":\"A\",\"mapping\":\"a\",\"x\":0.2,\"y\":0.2,\"size\":0.1}]}")).CameraSwipe is null, "legacy camera option remains unspecified without rewriting saved layouts");
Reject(() => Layout.Import(Encoding.UTF8.GetBytes("{\"version\":1,\"name\":\"old\",\"cameraSwipe\":\"on\",\"controls\":[{\"id\":\"a\",\"label\":\"A\",\"mapping\":\"a\",\"x\":0.2,\"y\":0.2,\"size\":0.1}]}")), "camera swipe flag rejects non-boolean data");
Ok(Layout.Import(JsonSerializer.SerializeToUtf8Bytes(disabled, JsonConfig.Options)).Controls.Single(c => c.Id == "face0").Enabled == false, "disabled controls survive export and import");
Ok(new Control("old", "A", "a", .2, .2, .1).Enabled is null, "legacy controls retain unspecified enabled state");
var eightWay = curated with { Controls = curated.Controls.Select(c => c.Type == "stick" ? c with { StickMode = "eightWay" } : c).ToArray() };
Ok(Layout.Import(JsonSerializer.SerializeToUtf8Bytes(eightWay, JsonConfig.Options)).Controls.Where(c => c.Type == "stick").All(c => c.StickMode == "eightWay"), "eight-way analog mode survives export and import");
Reject(() => (curated with { Controls = [new("invalid", "Stick", "leftStick", .2, .2, .1, "stick", StickMode: "invalid")] }).Validate(), "unknown analog mode rejected");
Reject(() => (curated with { Controls = [new("invalid", "A", "a", .2, .2, .1, StickMode: "eightWay")] }).Validate(), "button cannot declare analog mode");
Ok(new Control("old-stick", "Stick", "leftStick", .2, .2, .1, "stick").StickMode is null, "legacy analog retains free movement");

Reject(() => Layout.Import(Encoding.UTF8.GetBytes("{\"version\":1,\"name\":\"x\",\"controls\":[{\"id\":\"a\",\"label\":\"A\",\"mapping\":\"a\",\"x\":0.2,\"y\":0.2,\"size\":0.1,\"enabled\":\"off\"}]}")), "enabled state must be boolean or omitted");
Reject(() => Layout.Import(Encoding.UTF8.GetBytes("{\"version\":1,\"name\":\"x\",\"controls\":[],\"target\":\"cmd.exe\"}")), "layout cannot contain launcher");
Reject(() => (Presets.Get("umum") with { DeadZone = double.NaN }).Validate(), "invalid layout setting");
Reject(() => (Presets.Get("umum") with { Controls = [null!] }).Validate(), "null imported control");
var modeLayout = Presets.Get("dungeons") with { Modes = new() { ["menu"] = [new("menu-lb", "LB", "lb", .2, .3, .12)], ["inventory"] = [new("inventory-b", "Back", "b", .7, .8, .12)] } };
var roundtripModes = Layout.Import(JsonSerializer.SerializeToUtf8Bytes(modeLayout, JsonConfig.Options));
Ok(roundtripModes.DpadStyle == "joined" && Layout.Import(JsonSerializer.SerializeToUtf8Bytes(modeLayout with { DpadStyle = "split" }, JsonConfig.Options)).DpadStyle == "split", "both D-pad styles survive export/import");
Reject(() => (modeLayout with { DpadStyle = "unknown" }).Validate(), "unknown D-pad style rejected");
Reject(() => (modeLayout with { DpadStyle = null! }).Validate(), "null D-pad style rejected");
Ok(Layout.Import(Encoding.UTF8.GetBytes("{\"version\":1,\"name\":\"old\",\"controls\":[{\"id\":\"a\",\"label\":\"A\",\"mapping\":\"a\",\"x\":0.2,\"y\":0.2,\"size\":0.1}]}")).DpadStyle == "split", "legacy layout keeps separate controls");
Ok(roundtripModes.Modes!["menu"][0].Mapping == "lb" && roundtripModes.Modes["inventory"][0].Mapping == "b", "menu and inventory controls survive JSON roundtrip");
Reject(() => (modeLayout with { Modes = new() { ["unknown"] = modeLayout.Controls } }).Validate(), "unknown layout mode rejected");
Reject(() => (modeLayout with { Modes = new() { ["menu"] = null! } }).Validate(), "null mode controls rejected");
Reject(() => (modeLayout with { Modes = new() { ["menu"] = [] } }).Validate(), "empty mode controls rejected");
Reject(() => (modeLayout with { Modes = new() { ["menu"] = Enumerable.Repeat(modeLayout.Controls[0], 33).ToArray() } }).Validate(), "mode control count bounded");
Reject(() => (modeLayout with { Modes = new() { ["menu"] = [modeLayout.Controls[0], modeLayout.Controls[0]] } }).Validate(), "duplicate ids within mode rejected");
Reject(() => (modeLayout with { Modes = new() { ["inventory"] = [new("bad", "Bad", "launch", .2, .3, .1)] } }).Validate(), "mode mapping validation retained");
Reject(() => Layout.Import(Encoding.UTF8.GetBytes("{\"version\":1,\"name\":\"x\",\"controls\":[{\"id\":\"a\",\"label\":\"A\",\"mapping\":\"a\",\"x\":0.2,\"y\":0.2,\"size\":0.1}],\"modes\":{\"menu\":[{\"id\":\"a\",\"label\":\"A\",\"mapping\":\"a\",\"x\":0.2,\"y\":0.2,\"size\":0.1,\"target\":\"cmd.exe\"}]}}")), "mode controls cannot smuggle launcher fields");
Reject(() => new GameProof("verified", 0, "2026-11-07", "build", "unknown", "test").Validate(), "verified report needs actual player count");
Reject(() => new GameProof("verified", 2, "not a date", "build", "unknown", "test").Validate(), "report needs valid test date");
var clock = new TestClock(); var created = new List<FakePad>();
using var session = new Session(kind => { var pad = new FakePad(); created.Add(pad); return pad; }, clock);
session.Start(new("game", "Test", "unused", "umum"));
Reject(() => session.Join("wrong", "A", new('a', 32)), "wrong session invite");
var p = session.Join(session.Invite!, "A", new('a', 32));
Reject(() => session.Attach(p), "unapproved cannot attach");
session.Approve(p.Id); var connection = session.Attach(p);
Ok(session.Input(p, connection, new(1, ["a"])), "approved input");
Ok(!session.Input(p, connection, new(0, ["b"])), "old sequence ignored");
clock.Advance(399); session.Sweep(); Ok(created[0].State.Buttons.Contains("a"), "before timeout");
clock.Advance(1); session.Sweep(); Ok(created[0].State.Buttons.Length == 0, "neutral at 400ms");
session.Input(p, connection, new(2, ["b"])); var replacement = session.Attach(p);
Ok(!session.Input(p, connection, new(3, ["x"])), "old connection rejected");
session.Disconnect(p, connection); Ok(p.Disconnected is null, "old disconnect cannot detach replacement");
session.Input(p, replacement, new(0, ["x"])); session.Disconnect(p, replacement);
Ok(created[0].State.Buttons.Length == 0, "disconnect immediately neutral");
clock.Advance(59999); session.Sweep(); Ok(session.Players.Count == 1, "reservation before 60 seconds");
clock.Advance(1); session.Sweep(); Ok(session.Players.Count == 0 && created[0].Disposed, "release after 60 seconds");
var p2 = session.Join(session.Invite!, "B", new('b', 32)); session.Approve(p2.Id); var c2 = session.Attach(p2);
session.Pause(true); session.Input(p2, c2, new(1, ["a"])); Ok(created[1].State.Buttons.Length == 0, "emergency stop suppresses input");
session.End(); Reject(() => session.Auth(p2.Token), "old tokens invalid after end");
foreach (var driver in new[] { "xbox", "ds4" })
{
    session.Start(new("four", "Four fake pads", "unused", "umum", driver));
    var four = Enumerable.Range(0, Session.MaxPlayers).Select(i => { var item = session.Join(session.Invite!, "Sim " + i, new((char)('a' + i), 32)); return item; }).ToArray();
    Reject(() => session.Join(session.Invite!, "Fifth", new('z', 32)), driver + " fifth pending player rejected");
    foreach (var (item, i) in four.Select((value, index) => (value, index))) { session.Approve(item.Id); var attached = session.Attach(item); session.Input(item, attached, new(0, [new[] { "a", "b", "x", "y" }[i]])); }
    Ok(four.Select(e => e.State.Buttons.Single()).Distinct().Count() == 4, driver + " four controllers keep independent state");
    Reject(() => session.Join(session.Invite!, "Fifth", new('z', 32)), driver + " fifth approved player rejected");
    Ok(ReferenceEquals(session.Join(session.Invite!, "Reconnect", four[1].DeviceKey), four[1]), driver + " existing player can rejoin a full session");
    session.Remove(four[0].Id); Ok(four.Skip(1).All(e => e.Pad is FakePad { Disposed: false }), "removing one pad preserves other ownership");
    var next = session.Join(session.Invite!, "Replacement", new('z', 32)); session.Approve(next.Id); Ok(session.Players.Count == 4, driver + " removed place can be reused");
    session.End();
}
session.Start(new("rate", "Rate test", "unused", "umum"));
var ratePlayer = session.Join(session.Invite!, "Rate", new('r', 32)); session.Approve(ratePlayer.Id); var rateConnection = session.Attach(ratePlayer);
for (int i = 0; i < 90; i++) session.Input(ratePlayer, rateConnection, new(i, []));
Reject(() => session.Input(ratePlayer, rateConnection, new(90, [])), "input flood rejected");
session.End();
var directory = Path.Combine(Path.GetTempPath(), "BeeHooks-check-" + Guid.NewGuid());
try
{
    var store = new LibraryStore(directory); Ok(store.Data.Games.Length == 0, "first install empty");
    store.Save(store.Data with { Games = [new("id", "Game", "target", "umum", Proof: new("settings", 0, "2026-11-07", "build", "unknown", "No gameplay proof"))] });
    Ok(new LibraryStore(directory).Data.Games.Single().Name == "Game", "atomic persistence reload");
    Ok(new LibraryStore(directory).Data.Games.Single().Proof?.Status == "settings", "compatibility notes reload without derived data");
    store.Save(store.Data with { Games = [], Layouts = new() { ["mode-profile"] = modeLayout } }); Ok(File.Exists(Path.Combine(directory, "library.json.bak")), "previous data backed up");
    Ok(new LibraryStore(directory).Data.Layouts["mode-profile"].Modes!["menu"][0].Mapping == "lb", "mode layouts persist in library without resetting other data");
    Directory.CreateDirectory(Path.Combine(directory, "library.json.tmp"));
    bool failed = false; try { store.Save(store.Data with { Games = [new("bad", "Bad", "target", "umum")] }); } catch (IOException) { failed = true; } catch (UnauthorizedAccessException) { failed = true; }
    Ok(failed && store.Data.Games.Length == 0 && new LibraryStore(directory).Data.Games.Length == 0, "failed write preserves data and memory");
    var steam = Path.Combine(directory, "steam"); var cache = Path.Combine(steam, "appcache", "librarycache"); var covers = Path.Combine(directory, "covers");
    Directory.CreateDirectory(Path.Combine(cache, "42"));
    var artwork = File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory, "Fixtures", "artwork.jpg"));
    File.WriteAllBytes(Path.Combine(cache, "42", "library_hero.jpg"), artwork);
    File.WriteAllBytes(Path.Combine(cache, "42", "header.jpg"), [..artwork, 1]);
    Ok(GameFiles.CacheSteamCover("steam://rungameid/42", steam, covers) == "/covers/steam-42.jpg" && File.ReadAllBytes(Path.Combine(covers, "steam-42.jpg")).SequenceEqual(artwork), "Steam hero is cached locally ahead of header artwork");
    File.Delete(Path.Combine(cache, "42", "library_hero.jpg")); File.Delete(Path.Combine(cache, "42", "header.jpg"));
    Ok(GameFiles.CacheSteamCover("steam://rungameid/42", steam, covers) == "/covers/steam-42.jpg", "cached artwork survives Steam cache removal");
    File.WriteAllBytes(Path.Combine(cache, "43_header.jpg"), artwork);
    Ok(GameFiles.CacheSteamCover("steam://rungameid/43", steam, covers) == "/covers/steam-43.jpg", "legacy flat Steam artwork is supported");
    Ok(GameFiles.CacheSteamCover("steam://rungameid/44", steam, covers) is null && GameFiles.CacheSteamCover("steam://rungameid/42", null, covers) is null, "missing Steam cache returns no artwork");
    Ok(GameFiles.CacheSteamCover("steam://rungameid/../../private", steam, covers) is null && GameFiles.CacheSteamCover("com.epicgames.launcher://apps/game", steam, covers) is null, "artwork lookup rejects traversal and non-Steam targets");
    File.WriteAllText(Path.Combine(cache, "45_header.jpg"), "invalid image");
    Ok(GameFiles.CacheSteamCover("steam://rungameid/45", steam, covers) is null && !File.Exists(Path.Combine(covers, "steam-45.jpg")), "invalid artwork does not become a cached image");
    using (var large = File.Create(Path.Combine(cache, "46_header.jpg"))) large.SetLength(8 * 1024 * 1024 + 1);
    Ok(GameFiles.CacheSteamCover("steam://rungameid/46", steam, covers) is null, "oversized artwork is skipped");
    Ok(!Directory.EnumerateFiles(covers, "*.tmp").Any(), "artwork import leaves no temporary files");
    var pixels = Enumerable.Repeat((byte)255, 32 * 32 * 4).ToArray();
    var iconFrame = System.Windows.Media.Imaging.BitmapSource.Create(32, 32, 96, 96, System.Windows.Media.PixelFormats.Bgra32, null, pixels, 128);
    var iconEncoder = new System.Windows.Media.Imaging.PngBitmapEncoder(); iconEncoder.Frames.Add(System.Windows.Media.Imaging.BitmapFrame.Create(iconFrame));
    var iconSource = Path.Combine(cache, "42", new string('a', 40) + ".png"); using (var output = File.Create(iconSource)) iconEncoder.Save(output);
    var iconUrl = GameIcons.Cache("steam://rungameid/42", steam, covers);
    Ok(iconUrl is not null && File.Exists(Path.Combine(covers, Path.GetFileName(iconUrl))), "square Steam app icon is cached separately from cover");
    File.Delete(iconSource); Ok(GameIcons.Cache("steam://rungameid/42", steam, covers) == iconUrl, "app icon survives offline cache removal");
    Ok(GameIcons.Cache("steam://rungameid/../private", steam, covers) is null && GameIcons.Cache("steam://rungameid/43", steam, covers) is null, "icon lookup rejects traversal and does not substitute banner artwork");
    Ok(GameIcons.Cache(Path.Combine(AppContext.BaseDirectory, "BeeStation.exe"), null, covers) is not null, "local executable icon is extracted without launching the game");
    Ok(!Directory.EnumerateFiles(covers, "*.tmp").Any(), "app icon cache leaves no temporary files");
    var posterFrame = System.Windows.Media.Imaging.BitmapSource.Create(60, 90, 96, 96, System.Windows.Media.PixelFormats.Bgra32, null, new byte[60 * 90 * 4], 240);
    var posterEncoder = new System.Windows.Media.Imaging.JpegBitmapEncoder(); posterEncoder.Frames.Add(System.Windows.Media.Imaging.BitmapFrame.Create(posterFrame));
    var posterSource = Path.Combine(cache, "42", "library_600x900.jpg"); using (var output = File.Create(posterSource)) posterEncoder.Save(output);
    var posterUrl = GameFiles.CacheSteamCover("steam://rungameid/42", steam, covers, portrait: true);
    Ok(posterUrl == "/covers/steam-42-poster.jpg" && File.Exists(Path.Combine(covers, "steam-42.jpg")), "vertical poster uses a separate cache without replacing the backdrop cover");
    File.Delete(posterSource); Ok(GameFiles.CacheSteamCover("steam://rungameid/42", steam, covers, portrait: true) == posterUrl, "cached poster remains available offline");
    Ok(GameFiles.CacheSteamCover("steam://rungameid/43", steam, covers, portrait: true) is null, "missing poster does not substitute a horizontal banner");


}
finally { Directory.Delete(directory, true); }
await SteamTrailersChecks.Run(Ok);
Console.WriteLine($"PASS: {checks} checks; fake driver only, no game compatibility claim.");

static void Check(bool value, string label) { if (!value) throw new Exception("FAIL: " + label); Console.WriteLine("PASS: " + label); }
sealed class FakePad : IVirtualPad { public string Kind => "fake"; public PadState State = PadState.Neutral; public bool Disposed; public void Apply(PadState state) => State = state; public void Dispose() => Disposed = true; }
sealed class TestClock : TimeProvider { DateTimeOffset now = DateTimeOffset.Parse("2026-11-07T00:00:00Z"); public override DateTimeOffset GetUtcNow() => now; public void Advance(int ms) => now += TimeSpan.FromMilliseconds(ms); }
