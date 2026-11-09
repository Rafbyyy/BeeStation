using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;

namespace BeeHooks;

public static class Firewall
{
    public static string ValidatePorts(string ports)
    {
        var values = ports.Split(',');
        if (values.Length is < 1 or > 16 || values.Any(v => !int.TryParse(v, out var p) || p is < 1 or > 65535)) throw new ArgumentException("Port firewall tidak sah.");
        return string.Join(',', values.Select(int.Parse).Distinct().Order());
    }
    public static void Configure(string ports)
    {
        ports = ValidatePorts(ports);
        using var identity = WindowsIdentity.GetCurrent();
        if (!new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator)) throw new InvalidOperationException("Izin administrator diperlukan untuk aturan khusus BeeStation.");
        var executable = Environment.ProcessPath ?? throw new InvalidOperationException("Lokasi BeeStation tidak ditemukan.");
        var name = "BeeStation LAN " + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(executable.ToLowerInvariant())))[..16];
        dynamic policy = Activator.CreateInstance(Type.GetTypeFromProgID("HNetCfg.FwPolicy2")!)!;
        dynamic rule;
        bool exists = true;
        try { rule = policy.Rules.Item(name); }
        catch (System.Runtime.InteropServices.COMException) { exists = false; rule = Activator.CreateInstance(Type.GetTypeFromProgID("HNetCfg.FWRule")!)!; }
        if (exists && !string.Equals((string)rule.ApplicationName, executable, StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("Aturan bernama sama dimiliki aplikasi lain.");
        rule.Name = name; rule.Description = "BeeStation: TCP pada port host aktif; hanya perangkat satu subnet lokal. Dibuat atas permintaan pengguna.";
        rule.ApplicationName = executable; rule.Protocol = 6; rule.LocalPorts = ports;
        rule.Direction = 1; rule.Profiles = 6; rule.RemoteAddresses = "LocalSubnet";
        rule.Action = 1; rule.Enabled = true; rule.Grouping = "BeeStation";
        if (!exists) policy.Rules.Add(rule);
    }
}
