using System.Text.Json;
using System.Text.Json.Serialization;

namespace BeeHooks.Core;

public sealed record Control(string Id, string Label, string Mapping, double X, double Y, double Size, string Type = "button", [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Enabled = null, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? StickMode = null);
public sealed record Layout(int Version, string Name, Control[] Controls, double DeadZone = .12, double Sensitivity = 1, double Opacity = .9, bool LeftHanded = false, bool FloatingStick = false, Dictionary<string, Control[]>? Modes = null, string DpadStyle = "split", [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? CameraSwipe = null)
{
    public void Validate()
    {
        if (Version != 1 || string.IsNullOrWhiteSpace(Name) || Name.Length > 80)
            throw new ArgumentException("Versi/nama layout tidak sah.");
        if (!double.IsFinite(DeadZone) || DeadZone is < 0 or > .5 || !double.IsFinite(Sensitivity) || Sensitivity is < .2 or > 2 || !double.IsFinite(Opacity) || Opacity is < .25 or > 1)
            throw new ArgumentException("Pengaturan stik/transparansi tidak sah.");
        ValidateControls(Controls);
        if (DpadStyle is not ("joined" or "split")) throw new ArgumentException("Tampilan D-pad tidak dikenal.");
        if (Modes is not null)
        {
            if (Modes.Count > 2 || Modes.Keys.Any(k => k is not ("menu" or "inventory"))) throw new ArgumentException("Mode layout tidak dikenal.");
            foreach (var controls in Modes.Values) ValidateControls(controls);
        }
    }
    static void ValidateControls(Control[]? controls)
    {
        if (controls is null || controls.Length is < 1 or > 32 || controls.Any(c => c is null) || controls.Select(c => c.Id).Distinct().Count() != controls.Length)
            throw new ArgumentException("Jumlah/identitas kontrol layout tidak sah.");
        foreach (var c in controls)
        {
            if (c is null || string.IsNullOrWhiteSpace(c.Id) || c.Id.Length > 64 || string.IsNullOrWhiteSpace(c.Label) || c.Label.Length > 32 || c.Type is not ("button" or "stick") || !(PadState.KnownButtons.Contains(c.Mapping) || c.Mapping is "lt" or "rt" or "leftStick" or "rightStick") || (c.Type == "stick") != (c.Mapping is "leftStick" or "rightStick") || !double.IsFinite(c.X) || !double.IsFinite(c.Y) || !double.IsFinite(c.Size) || c.X is < 0 or > 1 || c.Y is < 0 or > 1 || c.Size is < .04 or > .35)
                throw new ArgumentException("Kontrol layout tidak sah.");
            if (c.StickMode is not (null or "analog" or "eightWay") || c.Type != "stick" && c.StickMode is not null)
                throw new ArgumentException("Model analog tidak sah.");
        }
    }
    public static Layout Import(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length > 32768) throw new ArgumentException("Layout maksimal 32 KB.");
        var value = JsonSerializer.Deserialize<Layout>(bytes, JsonConfig.Options) ?? throw new ArgumentException("Layout kosong.");
        value.Validate();
        return value;
    }
}

public sealed record GameProof(string Status, int Players, string Date, string GameVersion, string SteamInput, string Notes)
{
    public void Validate()
    {
        if (Status is not ("untested" or "verified" or "settings") || Players is < 0 or > 16 || Status == "verified" && Players < 1 || !DateOnly.TryParseExact(Date, "yyyy-MM-dd", out _) || string.IsNullOrWhiteSpace(GameVersion) || GameVersion.Length > 100 || SteamInput is null || SteamInput.Length > 200 || string.IsNullOrWhiteSpace(Notes) || Notes.Length > 1500) throw new ArgumentException("Lengkapi tanggal, versi, pengaturan, dan bukti hasil uji.");
    }
    [System.Text.Json.Serialization.JsonIgnore]
    public string Label => Status switch { "verified" => $"Terverifikasi {Players} pemain (laporan pengguna)", "settings" => "Perlu pengaturan tambahan", _ => "Belum diuji" };
}
public sealed record GameEntry(string Id, string Name, string Target, string Preset, string Driver = "xbox", string? Cover = null, Layout? Profile = null, GameProof? Proof = null);
public sealed record SavedData(int Version, GameEntry[] Games, Dictionary<string, Layout> Layouts);

public sealed class LibraryStore
{
    readonly string path;
    public SavedData Data { get; private set; }
    public LibraryStore(string directory)
    {
        Directory.CreateDirectory(directory);
        path = Path.Combine(directory, "library.json");
        Data = File.Exists(path) ? JsonSerializer.Deserialize<SavedData>(File.ReadAllBytes(path), JsonConfig.Options) ?? throw new InvalidDataException("Simpanan kosong.") : new(1, [], []);
        if (Data.Version != 1 || Data.Games is null || Data.Layouts is null) throw new InvalidDataException("Versi simpanan tidak didukung; berkas asli dipertahankan.");
        foreach (var layout in Data.Layouts.Values) layout.Validate();
    }
    public void Save(SavedData next)
    {
        var temporary = path + ".tmp";
        try
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(next, JsonConfig.Options);
            using (var stream = new FileStream(temporary, FileMode.Create, FileAccess.Write, FileShare.None, 4096, FileOptions.WriteThrough)) { stream.Write(bytes); stream.Flush(true); }
            if (File.Exists(path)) File.Replace(temporary, path, path + ".bak"); else File.Move(temporary, path);
            Data = next;
        }
        finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
}

public static class Presets
{
    public static readonly string[] Names = ["umum", "dungeons", "brawlhalla", "overcooked2"];
    public static Layout Get(string name)
    {
        if (!Names.Contains(name)) throw new ArgumentException("Preset tidak dikenal.");
        if (name == "dungeons")
        {
            using var stream = typeof(Presets).Assembly.GetManifestResourceStream("BeeHooks.DungeonsPreset") ?? throw new InvalidDataException("Preset Dungeons tidak tersedia.");
            using var data = new MemoryStream(); stream.CopyTo(data); return Layout.Import(data.ToArray());
        }
        var labels = name switch
        {
            "brawlhalla" => new[] { "Lompat", "Berat", "Ringan", "Lempar" },
            _ => new[] { "A", "B", "X", "Y" }
        };
        List<Control> controls = [new("stick", "Gerak", "leftStick", .19, .57, .24, "stick")];
        var positions = new[] { (.84, .72), (.93, .52), (.75, .52), (.84, .31) };
        for (int i = 0; i < 4; i++) controls.Add(new("face" + i, labels[i], new[] { "a", "b", "x", "y" }[i], positions[i].Item1, positions[i].Item2, .12));
        controls.AddRange([new("lb", "LB", "lb", .42, .27, .12), new("rb", name == "brawlhalla" ? "Lempar" : "RB", "rb", .58, .27, .12), new("lt", "LT", "lt", .42, .5, .12), new("rt", name == "brawlhalla" ? "Dodge" : "RT", "rt", .58, .5, .12), new("start", "Menu", "start", .58, .82, .12), new("back", "Back", "back", .42, .82, .12)]);
        if (name is "umum" or "brawlhalla")
            controls.AddRange([new("up", "↑", "up", .19, .31, .08), new("down", "↓", "down", .19, .84, .08), new("left", "←", "left", .07, .57, .08), new("right", "→", "right", .31, .57, .08)]);
        if (name == "umum") controls.AddRange([new("rightstick", "Lihat", "rightStick", .63, .64, .18, "stick"), new("ls", "LS", "ls", .34, .16, .07), new("rs", "RS", "rs", .66, .16, .07)]);
        return new(1, name, controls.ToArray(), CameraSwipe: name == "umum");
    }
}
