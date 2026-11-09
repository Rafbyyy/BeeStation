using System.Net;
using System.Net.NetworkInformation;

namespace BeeHooks;

public sealed record LanAdapter(string Name, string Address, string Mask);
public static class Network
{
    public static LanAdapter[] LanAdapters()
    {
        // Public/Private are Windows firewall categories, separate from RFC1918 LAN addresses.
        return NetworkInterface.GetAllNetworkInterfaces().Where(n => n.OperationalStatus == OperationalStatus.Up && n.Supports(NetworkInterfaceComponent.IPv4) && n.NetworkInterfaceType is not (NetworkInterfaceType.Loopback or NetworkInterfaceType.Tunnel))
            .SelectMany(n => n.GetIPProperties().UnicastAddresses.Where(a => a.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork && IsPrivateAddress(a.Address)).Select(a => new LanAdapter(n.Name, a.Address.ToString(), a.IPv4Mask.ToString()))).ToArray();
    }
    static bool IsPrivateAddress(IPAddress ip) { var b = ip.GetAddressBytes(); return b[0] == 10 || b[0] == 192 && b[1] == 168 || b[0] == 172 && b[1] is >= 16 and <= 31; }
    public static bool SameSubnet(IPAddress remote, LanAdapter adapter)
    {
        var a = remote.MapToIPv4().GetAddressBytes(); var b = IPAddress.Parse(adapter.Address).GetAddressBytes(); var mask = IPAddress.Parse(adapter.Mask).GetAddressBytes();
        return Enumerable.Range(0, 4).All(i => (a[i] & mask[i]) == (b[i] & mask[i]));
    }
}
