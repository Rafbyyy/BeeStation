using System.Security.Cryptography;

namespace BeeHooks.Core;

public sealed class Player(string name, string deviceKey, string token, DateTimeOffset now)
{
    public string Id { get; } = Guid.NewGuid().ToString("N");
    public string Name { get; } = name;
    public string DeviceKey { get; } = deviceKey;
    public string Token { get; } = token;
    public string Color { get; set; } = "#F5C451";
    public IVirtualPad? Pad { get; set; }
    public Guid Connection { get; set; }
    public DateTimeOffset LastInput { get; set; } = now;
    public DateTimeOffset? Disconnected { get; set; } = now;
    public long Sequence { get; set; } = -1;
    public long Frames { get; set; }
    public long RateBucket { get; set; }
    public int RateCount { get; set; }
    public PadState State { get; set; } = PadState.Neutral;
}

// All session mutations run under Gate, including the watchdog and driver writes.
public sealed class Session(Func<string, IVirtualPad> createPad, TimeProvider? clock = null) : IDisposable
{
    public const int MaxPlayers = 4;
    readonly TimeProvider time = clock ?? TimeProvider.System;
    public object Gate { get; } = new();
    public string? Id { get; private set; }
    public string? Invite { get; private set; }
    public GameEntry? Game { get; private set; }
    public List<Player> Players { get; } = [];
    public bool Paused { get; private set; }
    public void Start(GameEntry game)
    {
        End(); Id = RandomToken(); Invite = RandomToken(); Game = game; Paused = false;
    }
    public Player Join(string invite, string name, string key)
    {
        if (Id is null || invite != Invite) throw new ArgumentException("Sesi/QR tidak berlaku.");
        if (string.IsNullOrWhiteSpace(name) || name.Length > 32 || name.Any(char.IsControl) || string.IsNullOrEmpty(key) || key.Length is < 32 or > 128 || key.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '-')) throw new ArgumentException("Nama atau identitas perangkat tidak sah.");
        // The browser secret identifies saved layouts; it never grants approval in a new session.
        var existing = Players.Find(p => p.DeviceKey == key);
        if (existing is not null) return existing;
        if (Players.Count >= MaxPlayers) throw new ArgumentException($"Sesi penuh; maksimal {MaxPlayers} pemain. Host perlu mengeluarkan pemain untuk membuka tempat.");
        var p = new Player(name.Trim(), key, RandomToken(), time.GetUtcNow()) { Color = new[] { "#F5C451", "#79DAFF", "#EF9DCC", "#A1E5A4" }[Players.Count % 4] };
        Players.Add(p); return p;
    }
    public Player Auth(string token) => Players.Find(p => p.Token == token) ?? throw new ArgumentException("Sambungan tidak diizinkan.");
    public void Approve(string id)
    {
        var p = Find(id);
        if (p.Pad is not null) return;
        p.Pad = createPad(Game?.Driver ?? throw new ArgumentException("Sesi berakhir."));
        p.LastInput = time.GetUtcNow(); p.Disconnected = time.GetUtcNow();
    }
    public Guid Attach(Player p)
    {
        if (p.Pad is null) throw new ArgumentException("Menunggu persetujuan host.");
        Neutralize(p); p.Connection = Guid.NewGuid(); p.Sequence = -1; p.LastInput = time.GetUtcNow(); p.Disconnected = null;
        return p.Connection;
    }
    public bool Input(Player p, Guid connection, PadState state)
    {
        state.Validate();
        if (!Players.Contains(p) || p.Pad is null || connection != p.Connection || p.Disconnected is not null || state.Seq <= p.Sequence) return false;
        var now = time.GetUtcNow(); var bucket = now.ToUnixTimeSeconds();
        if (p.RateBucket != bucket) { p.RateBucket = bucket; p.RateCount = 0; }
        if (++p.RateCount > 90) throw new ArgumentException("Input terlalu sering.");
        p.Sequence = state.Seq; p.LastInput = now; p.Frames++;
        p.State = Paused ? PadState.Neutral : state; p.Pad.Apply(p.State); return true;
    }
    public void Disconnect(Player p, Guid connection)
    {
        if (connection != p.Connection) return;
        Neutralize(p); p.Disconnected ??= time.GetUtcNow();
    }
    public void Sweep()
    {
        var now = time.GetUtcNow();
        foreach (var p in Players.ToArray())
        {
            if (now - p.LastInput >= TimeSpan.FromMilliseconds(400)) Neutralize(p);
            if (p.Disconnected is { } since && now - since >= TimeSpan.FromSeconds(60)) Remove(p.Id);
        }
    }
    public void Pause(bool paused) { Paused = paused; foreach (var p in Players) Neutralize(p); }
    public void Remove(string id)
    {
        var p = Find(id);
        try { Neutralize(p); } finally { try { p.Pad?.Dispose(); } finally { Players.Remove(p); } }
    }
    public Player Find(string id) => Players.Find(p => p.Id == id) ?? throw new ArgumentException("Pemain tidak ditemukan.");
    static void Neutralize(Player p) { if (p.State != PadState.Neutral) { p.Pad?.Apply(PadState.Neutral); p.State = PadState.Neutral; } }
    public void End()
    {
        foreach (var p in Players.ToArray()) { try { Remove(p.Id); } catch { /* Continue releasing other BeeHooks devices after a driver fault. */ } }
        Players.Clear(); Id = null; Invite = null; Game = null;
    }
    public void Dispose() => End();
    static string RandomToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
}
