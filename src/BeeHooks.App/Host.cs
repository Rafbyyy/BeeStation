using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.WebSockets;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Windows;
using BeeHooks.Core;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;

namespace BeeHooks;

public sealed class Host : IDisposable
{
    public static string DataDirectory => Environment.GetEnvironmentVariable("BEEHOOKS_DATA") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BeeHooks");
    readonly LibraryStore store = new(DataDirectory);
    readonly Session session;
    readonly string? steamPath = GameFiles.SteamPath();
    readonly CancellationTokenSource stop = new();
    readonly Dictionary<string, (long Window, int Count)> joins = [];
    WebApplication? web;
    Task? watchdog;
    int disposed;
    LanAdapter[] adapters = [];
    public string AdminUrl { get; private set; } = "";
    string[] phoneUrls = [];
    public Host(Func<string, IVirtualPad>? createPad = null) { session = new(createPad ?? (kind => new VirtualPad(kind))); }
    public async Task Start()
    {
        adapters = Network.LanAdapters();
        var builder = WebApplication.CreateSlimBuilder(new WebApplicationOptions { ContentRootPath = AppContext.BaseDirectory });
        builder.Logging.ClearProviders(); // Tokens and player traffic must never enter HTTP access logs.
        builder.WebHost.ConfigureKestrel(k =>
        {
            k.Limits.MaxRequestBodySize = 32768; k.Limits.RequestHeadersTimeout = TimeSpan.FromSeconds(5);
            k.Listen(IPAddress.Loopback, 0);
            foreach (var adapter in adapters)
            {
                var ip = IPAddress.Parse(adapter.Address);
                int port = 32100;
                var probe = new System.Net.Sockets.TcpListener(ip, port);
                try { probe.Start(); } catch (System.Net.Sockets.SocketException) { port = 0; } finally { probe.Stop(); }
                k.Listen(ip, port);
            }
        });
        web = builder.Build();
        web.Use(async (context, next) =>
        {
            try
            {
                context.Response.Headers.ContentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
                context.Response.Headers.XContentTypeOptions = "nosniff";
                context.Response.Headers["Referrer-Policy"] = "no-referrer";
                context.Response.Headers.CacheControl = "no-store";
                var host = context.Request.Host;
                // Exact numeric host and bound port prevent DNS rebinding to a local admin server.
                if (host.Host != context.Connection.LocalIpAddress?.ToString() || host.Port != context.Connection.LocalPort) { context.Response.StatusCode = 403; return; }
                var origin = context.Request.Headers.Origin.ToString();
                if (origin.Length > 0 && origin != $"http://{host}") { context.Response.StatusCode = 403; return; }
                bool local = IPAddress.IsLoopback(context.Connection.RemoteIpAddress!) && context.Request.Host.Value == new Uri(AdminUrl).Authority;
                // Only the local Studio preview may be embedded by this same origin.
                if (local && context.Request.Path == "/controller.html" && context.Request.Query.ContainsKey("studio"))
                    context.Response.Headers.ContentSecurityPolicy = context.Response.Headers.ContentSecurityPolicy.ToString().Replace("frame-ancestors 'none'", "frame-ancestors 'self'");
                if (!local)
                {
                    var adapter = Network.LanAdapters().FirstOrDefault(a => a.Address == context.Connection.LocalIpAddress?.ToString());
                    if (adapter is null || !Network.SameSubnet(context.Connection.RemoteIpAddress!, adapter)) { context.Response.StatusCode = 403; return; }
                }
                if (context.Request.Path.StartsWithSegments("/api/admin") && (!local || context.Request.Headers["X-BeeHooks"] != "local")) { context.Response.StatusCode = 403; return; }
                if (context.Request.Method == "POST" && !context.Request.HasJsonContentType()) throw new ArgumentException("Gunakan JSON.");
                if (!local && context.Request.Path == "/") { context.Response.Redirect("/controller.html"); return; }
                await next();
            }
            catch (Exception e) when (e is ArgumentException or JsonException or InvalidOperationException or IOException or UnauthorizedAccessException or System.ComponentModel.Win32Exception or Nefarius.ViGEm.Client.Exceptions.VigemBusNotFoundException)
            {
                if (!context.Response.HasStarted)
                {
                    context.Response.StatusCode = 400;
                    var message = e is Nefarius.ViGEm.Client.Exceptions.VigemBusNotFoundException ? "ViGEmBus belum tersedia. Pasang driver resmi 1.22.0, lalu mulai ulang BeeStation." : e.Message;
                    await context.Response.WriteAsJsonAsync(new { error = message });
                }
            }
        });
        web.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(10) });
        var root = Path.Combine(AppContext.BaseDirectory, "wwwroot");
        web.UseDefaultFiles(new DefaultFilesOptions { FileProvider = new PhysicalFileProvider(root) });
        web.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(root) });
        var covers = Path.Combine(DataDirectory, "covers"); Directory.CreateDirectory(covers);
        web.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(covers), RequestPath = "/covers" });
        MapRoutes(web);
        await web.StartAsync();
        var addresses = web.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses;
        AdminUrl = addresses.Single(a => a.StartsWith("http://127.0.0.1:"));
        phoneUrls = addresses.Where(a => a != AdminUrl).ToArray();
        watchdog = Task.Run(async () =>
        {
            using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(50));
            try { while (await timer.WaitForNextTickAsync(stop.Token)) lock (session.Gate) { try { session.Sweep(); } catch { session.End(); } } }
            catch (OperationCanceledException) { }
        });
    }
    void MapRoutes(WebApplication app)
    {
        app.MapGet("/api/admin/status", () =>
        {
            lock (session.Gate) return Results.Json(new
            {
                games = store.Data.Games.Select(g => new { g.Id, g.Name, g.Target, g.Preset, g.Driver, g.Cover, poster = GameFiles.CacheSteamCover(g.Target, steamPath, Path.Combine(DataDirectory, "covers"), portrait: true), icon = GameIcons.Cache(g.Target, steamPath, Path.Combine(DataDirectory, "covers")), artwork = g.Cover ?? GameFiles.CacheSteamCover(g.Target, steamPath, Path.Combine(DataDirectory, "covers")), g.Profile, g.Proof, exists = GameFiles.Exists(g.Target), compatibility = g.Proof?.Label ?? "Belum diuji" }),
                adapters, phoneUrls, adminUrl = AdminUrl, xinput = XInput.Connected(), maxPlayers = Session.MaxPlayers,
                session = session.Id is null ? null : new { session.Id, gameId = session.Game!.Id, invite = session.Invite, paused = session.Paused },
                players = session.Players.Select(p => new { p.Id, p.Name, p.Color, approved = p.Pad is not null, connected = p.Disconnected is null, p.Frames, state = p.State, kind = p.Pad?.Kind, idleMs = (DateTimeOffset.UtcNow - p.LastInput).TotalMilliseconds }),
                note = phoneUrls.Length == 0 ? "Alamat LAN belum ditemukan. Hubungkan PC ke Wi-Fi/LAN, lalu buka ulang BeeStation." : "Profil Umum/Public atau Private dapat dipakai. Jika HP terblokir, izinkan akses khusus BeeStation. Nomor pemain game belum diverifikasi."
            });
        });
        app.MapGet("/api/admin/discover", () => Results.Json(GameFiles.Discover()));
        app.MapGet("/api/admin/studio/{gameId}", (string gameId, string? playerId) =>
        {
            if (!string.IsNullOrEmpty(playerId)) throw new ArgumentException("Controller Studio hanya mengatur default game. Profil pribadi diatur dari HP.");
            lock (session.Gate)
            {
                var game = store.Data.Games.FirstOrDefault(g => g.Id == gameId) ?? throw new ArgumentException("Game tidak ditemukan.");
                return Results.Json(new { layout = game.Profile ?? Presets.Get(game.Preset), preset = game.Preset });
            }
        });
        app.MapPost("/api/admin/studio/{gameId}", async (string gameId, string? playerId, HttpContext context) =>
        {
            if (!string.IsNullOrEmpty(playerId)) throw new ArgumentException("Controller Studio hanya mengatur default game. Profil pribadi diatur dari HP.");
            var layout = Layout.Import(await ReadBytes(context));
            lock (session.Gate)
            {
                var game = store.Data.Games.FirstOrDefault(g => g.Id == gameId) ?? throw new ArgumentException("Game tidak ditemukan.");
                store.Save(store.Data with { Games = store.Data.Games.Select(g => g.Id == gameId ? g with { Profile = layout } : g).ToArray() });
                return Results.Ok();
            }
        });
        app.MapGet("/api/admin/artwork/{id}", async (string id, bool? audio, HttpContext context) =>
        {
            GameEntry game;
            lock (session.Gate) game = store.Data.Games.FirstOrDefault(g => g.Id == id) ?? throw new ArgumentException("Game tidak ditemukan.");
            if (audio == true) return Results.Json(new { audio = await SteamTrailers.EnsureAudioAsync(game.Target, Path.Combine(DataDirectory, "covers"), context.RequestAborted) });
            var video = await SteamTrailers.EnsureAsync(game.Target, Path.Combine(DataDirectory, "covers"), context.RequestAborted);
            return Results.Json(new { video });
        });
        app.MapPost("/api/admin/firewall", () =>
        {
            var executable = Environment.ProcessPath!;
            if (!System.IO.Path.GetFileName(executable).Equals("BeeStation.exe", StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("Buka paket BeeStation.exe untuk membuat izin ini.");
            if (phoneUrls.Length == 0) throw new ArgumentException("Hubungkan PC ke LAN dahulu.");
            var ports = Firewall.ValidatePorts(string.Join(',', phoneUrls.Select(u => new Uri(u).Port)));
            var start = new ProcessStartInfo(executable) { UseShellExecute = true, Verb = "runas", WindowStyle = ProcessWindowStyle.Hidden };
            start.ArgumentList.Add("--configure-firewall"); start.ArgumentList.Add(ports); Process.Start(start);
            return Results.Json(new { message = "Setujui permintaan Windows untuk izin khusus BeeStation. Tidak ada perubahan kategori jaringan atau firewall global." });
        });
        app.MapGet("/api/admin/preset/{name}", (string name) => Results.Json(Presets.Get(name)));
        app.MapPost("/api/admin/pick", async (HttpContext context) =>
        {
            var request = await Read<PickRequest>(context);
            return await Application.Current.Dispatcher.InvokeAsync(() =>
            {
                var dialog = new Microsoft.Win32.OpenFileDialog { Filter = request.Cover ? "Gambar|*.png;*.jpg;*.jpeg" : "Game atau shortcut|*.exe;*.lnk;*.url", CheckFileExists = true };
                if (dialog.ShowDialog() != true) return Results.Json(new { path = (string?)null });
                if (!request.Cover) return Results.Json(new { path = dialog.FileName });
                var info = new FileInfo(dialog.FileName); if (info.Length > 8 * 1024 * 1024) throw new ArgumentException("Sampul maksimal 8 MB.");
                using var stream = File.OpenRead(info.FullName);
                var image = System.Windows.Media.Imaging.BitmapDecoder.Create(stream, System.Windows.Media.Imaging.BitmapCreateOptions.None, System.Windows.Media.Imaging.BitmapCacheOption.OnLoad);
                if (image.Frames[0].PixelWidth > 8192 || image.Frames[0].PixelHeight > 8192) throw new ArgumentException("Sampul terlalu besar.");
                var file = Guid.NewGuid().ToString("N") + info.Extension.ToLowerInvariant(); File.Copy(info.FullName, Path.Combine(DataDirectory, "covers", file));
                return Results.Json(new { path = "/covers/" + file });
            });
        });
        app.MapPost("/api/admin/game", async (HttpContext context) =>
        {
            var game = await Read<GameEntry>(context);
            if (string.IsNullOrWhiteSpace(game.Name) || game.Name.Length > 100 || !Presets.Names.Contains(game.Preset) || game.Driver is not ("xbox" or "ds4")) throw new ArgumentException("Nama, preset, atau controller tidak sah.");
            var target = GameFiles.ValidateTarget(game.Target); game.Profile?.Validate(); game.Proof?.Validate();
            if (game.Cover is not null && (!System.Text.RegularExpressions.Regex.IsMatch(game.Cover, @"^/covers/[a-f0-9]{32}\.(png|jpg|jpeg)$") || !File.Exists(Path.Combine(DataDirectory, game.Cover.TrimStart('/').Replace('/', Path.DirectorySeparatorChar))))) throw new ArgumentException("Sampul tidak ditemukan.");
            lock (session.Gate)
            {
                var duplicate = store.Data.Games.FirstOrDefault(g => g.Id != game.Id && g.Target.Equals(target, StringComparison.OrdinalIgnoreCase));
                if (duplicate is not null) return Results.Json(new { duplicate = duplicate.Id });
                if (session.Game?.Id == game.Id) throw new ArgumentException("Akhiri sesi sebelum mengubah game/profil.");
                var saved = game with { Id = store.Data.Games.Any(g => g.Id == game.Id) ? game.Id : Guid.NewGuid().ToString("N"), Target = target };
                store.Save(store.Data with { Games = store.Data.Games.Where(g => g.Id != saved.Id).Append(saved).ToArray() });
                return Results.Json(saved);
            }
        });
        app.MapDelete("/api/admin/game/{id}", (string id) =>
        {
            lock (session.Gate)
            {
                if (session.Game?.Id == id) throw new ArgumentException("Akhiri sesi dahulu.");
                store.Save(store.Data with { Games = store.Data.Games.Where(g => g.Id != id).ToArray() }); return Results.Ok();
            }
        });
        app.MapPost("/api/admin/session/{id}", (string id) =>
        {
            lock (session.Gate)
            {
                if (session.Id is not null) throw new ArgumentException("Akhiri sesi aktif dahulu.");
                var game = store.Data.Games.Single(g => g.Id == id); GameFiles.ValidateTarget(game.Target); session.Start(game); return Results.Ok();
            }
        });
        app.MapDelete("/api/admin/session", () => { lock (session.Gate) session.End(); return Results.Ok(); });
        app.MapPost("/api/admin/player/{id}/approve", (string id) => { lock (session.Gate) session.Approve(id); return Results.Ok(); });
        app.MapPost("/api/admin/player/{id}/kick", (string id) => { lock (session.Gate) session.Remove(id); return Results.Ok(); });
        app.MapPost("/api/admin/pause", async (HttpContext c) => { var value = await Read<PauseRequest>(c); lock (session.Gate) session.Pause(value.Paused); return Results.Ok(); });
        app.MapPost("/api/admin/launch/{id}", (string id) => { lock (session.Gate) GameFiles.Launch(store.Data.Games.Single(g => g.Id == id)); return Results.Ok(); });
        app.MapPost("/api/join", async (HttpContext c) =>
        {
            var value = await Read<JoinRequest>(c);
            lock (session.Gate)
            {
                string address = c.Connection.RemoteIpAddress!.ToString(); long now = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 60;
                if (joins.Count > 256) foreach (var key in joins.Where(k => k.Value.Window != now).Select(k => k.Key).ToArray()) joins.Remove(key);
                var rate = joins.GetValueOrDefault(address); int count = rate.Window == now ? rate.Count + 1 : 1; joins[address] = (now, count);
                if (count > 20) throw new ArgumentException("Terlalu banyak permintaan. Tunggu satu menit.");
                var p = session.Join(value.Invite, value.Name, value.DeviceKey);
                return Results.Json(new { token = p.Token, sessionId = session.Id });
            }
        });
        app.MapGet("/api/player", (HttpContext c) =>
        {
            lock (session.Gate)
            {
                var p = session.Auth(Bearer(c));
                var game = store.Data.Games.First(g => g.Id == session.Game!.Id);
                return Results.Json(new { p.Name, p.Color, approved = p.Pad is not null, sessionId = session.Id, game = game.Name, gameId = game.Id, preset = game.Preset, paused = session.Paused, layout = store.Data.Layouts.GetValueOrDefault(LayoutKey(p, game)) ?? game.Profile ?? Presets.Get(game.Preset), mappingStatus = "Pemetaan awal; cocokkan dengan pengaturan game. Belum diverifikasi di game nyata." });
            }
        });
        app.MapGet("/api/player/preset", (HttpContext c) => { lock (session.Gate) { session.Auth(Bearer(c)); var game = store.Data.Games.First(g => g.Id == session.Game!.Id); return Results.Json(game.Profile ?? Presets.Get(game.Preset)); } });
        app.MapPost("/api/player/layout/validate", async (HttpContext c) => { lock (session.Gate) session.Auth(Bearer(c)); Layout.Import(await ReadBytes(c)); return Results.Ok(); });
        app.MapPost("/api/player/layout", async (HttpContext c) =>
        {
            var bytes = await ReadBytes(c); var layout = Layout.Import(bytes);
            lock (session.Gate)
            {
                var p = session.Auth(Bearer(c)); if (p.Pad is null) throw new ArgumentException("Host belum menyetujui pemain.");
                var layouts = new Dictionary<string, Layout>(store.Data.Layouts) { [LayoutKey(p, session.Game!)] = layout };
                store.Save(store.Data with { Layouts = layouts }); return Results.Ok();
            }
        });
        app.MapGet("/api/player/profiles", (HttpContext c) =>
        {
            lock (session.Gate)
            {
                var p = session.Auth(Bearer(c)); var prefix = LayoutKey(p, session.Game!) + ":copy:";
                return Results.Json(store.Data.Layouts.Where(k => k.Key.StartsWith(prefix, StringComparison.Ordinal)).Select(k => new { id = k.Key[prefix.Length..], layout = k.Value }));
            }
        });
        app.MapPost("/api/player/layout/copy", async (HttpContext c) =>
        {
            var layout = Layout.Import(await ReadBytes(c));
            lock (session.Gate)
            {
                var p = session.Auth(Bearer(c)); if (p.Pad is null) throw new ArgumentException("Host belum menyetujui pemain.");
                var prefix = LayoutKey(p, session.Game!) + ":copy:";
                if (store.Data.Layouts.Keys.Count(k => k.StartsWith(prefix, StringComparison.Ordinal)) >= 32) throw new ArgumentException("Maksimal 32 salinan profil per game/perangkat.");
                var layouts = new Dictionary<string, Layout>(store.Data.Layouts) { [prefix + Guid.NewGuid().ToString("N")] = layout };
                store.Save(store.Data with { Layouts = layouts }); return Results.Ok();
            }
        });
        app.MapGet("/ws", Socket);
    }
    async Task Socket(HttpContext context)
    {
        if (!context.WebSockets.IsWebSocketRequest) { context.Response.StatusCode = 400; return; }
        using var socket = await context.WebSockets.AcceptWebSocketAsync();
        Player? player = null; Guid connection = default;
        using var lifetime = CancellationTokenSource.CreateLinkedTokenSource(stop.Token, context.RequestAborted);
        try
        {
            lifetime.CancelAfter(TimeSpan.FromSeconds(5));
            var auth = JsonSerializer.Deserialize<AuthRequest>(await Receive(socket, lifetime.Token), JsonConfig.Options) ?? throw new ArgumentException("Token kosong.");
            lock (session.Gate) { player = session.Auth(auth.Token); connection = session.Attach(player); }
            lifetime.CancelAfter(Timeout.InfiniteTimeSpan);
            await socket.SendAsync(Encoding.UTF8.GetBytes("{\"type\":\"ready\"}"), WebSocketMessageType.Text, true, lifetime.Token);
            long pingBucket = 0; int pings = 0; long lastNetworkCheck = 0;
            while (socket.State == WebSocketState.Open && !stop.IsCancellationRequested)
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token); timeout.CancelAfter(TimeSpan.FromSeconds(5));
                var bytes = await Receive(socket, timeout.Token); var started = Stopwatch.GetTimestamp();
                if (!IPAddress.IsLoopback(context.Connection.RemoteIpAddress!) && Environment.TickCount64-lastNetworkCheck>=1000)
                {
                    if (!Network.LanAdapters().Any(a => a.Address == context.Connection.LocalIpAddress?.ToString() && Network.SameSubnet(context.Connection.RemoteIpAddress!, a))) throw new ArgumentException("Perangkat tidak lagi berada pada subnet LAN host.");
                    lastNetworkCheck = Environment.TickCount64;
                }
                using var doc = JsonDocument.Parse(bytes);
                if (doc.RootElement.TryGetProperty("type", out var type) && type.GetString() == "ping")
                {
                    lock (session.Gate) if (!session.Players.Contains(player) || player.Connection != connection) throw new ArgumentException("Sambungan diganti.");
                    long bucket = Environment.TickCount64 / 1000; if (bucket != pingBucket) { pingBucket = bucket; pings = 0; }
                    if (++pings > 3) throw new ArgumentException("Ping terlalu sering.");
                    var at = doc.RootElement.GetProperty("at").GetDouble(); if (!double.IsFinite(at)) throw new ArgumentException("Ping tidak sah.");
                    await socket.SendAsync(JsonSerializer.SerializeToUtf8Bytes(new { type = "pong", at }), WebSocketMessageType.Text, true, lifetime.Token); continue;
                }
                var input = PadState.Parse(bytes);
                bool applied; lock (session.Gate) applied = session.Input(player, connection, input);
                if (!applied) continue;
                var processingMs = Stopwatch.GetElapsedTime(started).TotalMilliseconds;
                await socket.SendAsync(JsonSerializer.SerializeToUtf8Bytes(new { type = "ack", seq = input.Seq, processingMs }), WebSocketMessageType.Text, true, lifetime.Token);
            }
        }
        catch (Exception e) when (e is WebSocketException or OperationCanceledException or ArgumentException or JsonException or InvalidOperationException) { }
        finally
        {
            if (player is not null) lock (session.Gate) session.Disconnect(player, connection);
            socket.Abort();
        }
    }
    static async Task<byte[]> Receive(WebSocket socket, CancellationToken token)
    {
        var buffer = new byte[2049]; int length = 0;
        while (true)
        {
            var received = await socket.ReceiveAsync(buffer.AsMemory(length), token);
            if (received.MessageType != WebSocketMessageType.Text) throw new ArgumentException("Pesan harus teks.");
            length += received.Count; if (length > 2048) throw new ArgumentException("Pesan maksimal 2 KB.");
            if (received.EndOfMessage) return buffer[..length];
        }
    }
    static string LayoutKey(Player p, GameEntry game) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(p.DeviceKey))) + ":" + game.Id;
    static string Bearer(HttpContext c) => c.Request.Headers.Authorization.ToString().StartsWith("Bearer ", StringComparison.Ordinal) ? c.Request.Headers.Authorization.ToString()[7..] : "";
    static async Task<T> Read<T>(HttpContext c) => JsonSerializer.Deserialize<T>(await ReadBytes(c), JsonConfig.Options) ?? throw new ArgumentException("Data kosong.");
    static async Task<byte[]> ReadBytes(HttpContext c)
    {
        using var stream = new MemoryStream(); var buffer = new byte[4096];
        while (true) { int n = await c.Request.Body.ReadAsync(buffer); if (n == 0) break; if (stream.Length + n > 32768) throw new ArgumentException("Data maksimal 32 KB."); stream.Write(buffer, 0, n); }
        return stream.ToArray();
    }
    public void Dispose()
    {
        if (Interlocked.Exchange(ref disposed, 1) != 0) return;
        stop.Cancel(); lock (session.Gate) session.End();
        if (web is not null) Task.Run(async () => { using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2)); await web.StopAsync(timeout.Token); await web.DisposeAsync(); }).GetAwaiter().GetResult();
        stop.Dispose();
    }
    sealed record PickRequest(bool Cover);
    sealed record PauseRequest(bool Paused);
    sealed record JoinRequest(string Invite, string Name, string DeviceKey);
    sealed record AuthRequest(string Token);
}
