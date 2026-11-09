using System.Text.Json;
using System.Text.Json.Serialization;

namespace BeeHooks.Core;

public sealed record PadState([property: JsonRequired] long Seq, [property: JsonRequired] string[] Buttons, [property: JsonRequired] double LX = 0, [property: JsonRequired] double LY = 0, [property: JsonRequired] double RX = 0, [property: JsonRequired] double RY = 0, [property: JsonRequired] double LT = 0, [property: JsonRequired] double RT = 0)
{
    public static readonly PadState Neutral = new(0, []);
    public static readonly HashSet<string> KnownButtons = ["a", "b", "x", "y", "up", "down", "left", "right", "lb", "rb", "ls", "rs", "start", "back"];
    public void Validate()
    {
        if (Seq < 0 || Seq > 9007199254740991 || Buttons is null || Buttons.Length > 14 || Buttons.Distinct().Count() != Buttons.Length || Buttons.Any(b => !KnownButtons.Contains(b)))
            throw new ArgumentException("Tombol atau urutan input tidak sah.");
        if (new[] { LX, LY, RX, RY }.Any(v => !double.IsFinite(v) || v < -1 || v > 1) || new[] { LT, RT }.Any(v => !double.IsFinite(v) || v < 0 || v > 1))
            throw new ArgumentException("Nilai stik atau trigger tidak sah.");
    }
    public static PadState Parse(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length > 2048) throw new ArgumentException("Pesan terlalu besar.");
        var state = JsonSerializer.Deserialize<PadState>(bytes, JsonConfig.Options) ?? throw new ArgumentException("Input kosong.");
        state.Validate();
        return state;
    }
}

public interface IVirtualPad : IDisposable
{
    string Kind { get; }
    void Apply(PadState state);
}

public static class JsonConfig
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web) { WriteIndented = true, UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow };
}
