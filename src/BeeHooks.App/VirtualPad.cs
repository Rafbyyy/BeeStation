using BeeHooks.Core;
using Nefarius.ViGEm.Client;
using Nefarius.ViGEm.Client.Targets;
using Nefarius.ViGEm.Client.Targets.Xbox360;
using Nefarius.ViGEm.Client.Targets.DualShock4;
using System.Runtime.InteropServices;

namespace BeeHooks;

public sealed class VirtualPad : IVirtualPad
{
    readonly ViGEmClient client;
    readonly IXbox360Controller? xbox;
    readonly IDualShock4Controller? ds4;
    public string Kind { get; }
    public VirtualPad(string kind)
    {
        if (kind is not ("xbox" or "ds4")) throw new ArgumentException("Jenis controller tidak sah.");
        Kind = kind;
        client = new ViGEmClient();
        try
        {
            if (kind == "xbox")
            {
                if (XInput.Connected().Length >= 4) throw new InvalidOperationException("Empat slot XInput sudah terpakai, termasuk controller fisik.");
                xbox = client.CreateXbox360Controller(); xbox.AutoSubmitReport = false; xbox.Connect();
            }
            else { ds4 = client.CreateDualShock4Controller(); ds4.AutoSubmitReport = false; ds4.Connect(); }
            Apply(PadState.Neutral);
        }
        catch { Dispose(); throw; }
    }
    public void Apply(PadState state)
    {
        var b = state.Buttons.ToHashSet();
        if (xbox is not null)
        {
            xbox.ResetReport();
            (string, Xbox360Button)[] map = [("a", Xbox360Button.A), ("b", Xbox360Button.B), ("x", Xbox360Button.X), ("y", Xbox360Button.Y), ("lb", Xbox360Button.LeftShoulder), ("rb", Xbox360Button.RightShoulder), ("ls", Xbox360Button.LeftThumb), ("rs", Xbox360Button.RightThumb), ("start", Xbox360Button.Start), ("back", Xbox360Button.Back), ("up", Xbox360Button.Up), ("down", Xbox360Button.Down), ("left", Xbox360Button.Left), ("right", Xbox360Button.Right)];
            foreach (var (name, button) in map) xbox.SetButtonState(button, b.Contains(name));
            xbox.SetAxisValue(Xbox360Axis.LeftThumbX, Axis(state.LX)); xbox.SetAxisValue(Xbox360Axis.LeftThumbY, Axis(-state.LY));
            xbox.SetAxisValue(Xbox360Axis.RightThumbX, Axis(state.RX)); xbox.SetAxisValue(Xbox360Axis.RightThumbY, Axis(-state.RY));
            xbox.SetSliderValue(Xbox360Slider.LeftTrigger, (byte)Math.Round(state.LT * 255)); xbox.SetSliderValue(Xbox360Slider.RightTrigger, (byte)Math.Round(state.RT * 255));
            xbox.SubmitReport();
        }
        if (ds4 is not null)
        {
            ds4.ResetReport();
            (string, DualShock4Button)[] map = [("a", DualShock4Button.Cross), ("b", DualShock4Button.Circle), ("x", DualShock4Button.Square), ("y", DualShock4Button.Triangle), ("lb", DualShock4Button.ShoulderLeft), ("rb", DualShock4Button.ShoulderRight), ("ls", DualShock4Button.ThumbLeft), ("rs", DualShock4Button.ThumbRight), ("start", DualShock4Button.Options), ("back", DualShock4Button.Share)];
            foreach (var (name, button) in map) ds4.SetButtonState(button, b.Contains(name));
            int dx = (b.Contains("right") ? 1 : 0) - (b.Contains("left") ? 1 : 0), dy = (b.Contains("down") ? 1 : 0) - (b.Contains("up") ? 1 : 0);
            var direction = (dx, dy) switch { (0, -1) => DualShock4DPadDirection.North, (1, -1) => DualShock4DPadDirection.Northeast, (1, 0) => DualShock4DPadDirection.East, (1, 1) => DualShock4DPadDirection.Southeast, (0, 1) => DualShock4DPadDirection.South, (-1, 1) => DualShock4DPadDirection.Southwest, (-1, 0) => DualShock4DPadDirection.West, (-1, -1) => DualShock4DPadDirection.Northwest, _ => DualShock4DPadDirection.None };
            ds4.SetDPadDirection(direction);
            ds4.SetAxisValue(DualShock4Axis.LeftThumbX, DsAxis(state.LX)); ds4.SetAxisValue(DualShock4Axis.LeftThumbY, DsAxis(state.LY));
            ds4.SetAxisValue(DualShock4Axis.RightThumbX, DsAxis(state.RX)); ds4.SetAxisValue(DualShock4Axis.RightThumbY, DsAxis(state.RY));
            ds4.SetSliderValue(DualShock4Slider.LeftTrigger, (byte)Math.Round(state.LT * 255)); ds4.SetSliderValue(DualShock4Slider.RightTrigger, (byte)Math.Round(state.RT * 255));
            ds4.SetButtonState(DualShock4Button.TriggerLeft, state.LT > .5); ds4.SetButtonState(DualShock4Button.TriggerRight, state.RT > .5);
            ds4.SubmitReport();
        }
    }
    static short Axis(double value) => (short)Math.Round(value * (value < 0 ? 32768 : 32767));
    static byte DsAxis(double value) => (byte)Math.Round((value + 1) * 127.5);
    public void Dispose()
    {
        try { if (xbox is not null) { try { xbox.ResetReport(); xbox.SubmitReport(); } finally { xbox.Disconnect(); } } }
        finally { try { if (ds4 is not null) { try { ds4.ResetReport(); ds4.SubmitReport(); } finally { ds4.Disconnect(); } } } finally { client.Dispose(); } }
    }
}

public static class XInput
{
    [StructLayout(LayoutKind.Sequential)] public struct State { public uint Packet; public ushort Buttons; public byte LT, RT; public short LX, LY, RX, RY; }
    [DllImport("xinput1_4.dll", EntryPoint = "XInputGetState")] public static extern uint GetState(uint index, out State state);
    public static uint[] Connected() => Enumerable.Range(0, 4).Select(i => (uint)i).Where(i => GetState(i, out _) == 0).ToArray();
}
