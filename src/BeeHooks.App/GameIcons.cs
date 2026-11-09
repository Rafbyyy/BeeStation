using System.IO;
using Microsoft.Win32;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media.Imaging;

namespace BeeHooks;

public static class GameIcons
{
    public static string? Cache(string target, string? steam, string directory)
    {
        var name = "icon-v2-" + Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(target))).ToLowerInvariant() + ".png";
        var destination = Path.Combine(directory, name);
        string? temporary = null;
        try
        {
            if (File.Exists(destination)) return "/covers/" + name;
            BitmapSource? bitmap = null;
            var match = Regex.Match(target, @"^steam://rungameid/(\d{1,12})$");
            if (match.Success && steam is not null)
            {
                var folder = Path.Combine(steam, "appcache", "librarycache", match.Groups[1].Value);
                using var registration = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Steam App " + match.Groups[1].Value);
                var registeredIcon = registration?.GetValue("DisplayIcon") as string;
                var trustedIcons = Path.GetFullPath(Path.Combine(steam, "steam", "games")) + Path.DirectorySeparatorChar;
                if (registeredIcon is not null && registeredIcon.StartsWith(trustedIcons, StringComparison.OrdinalIgnoreCase) && Regex.IsMatch(Path.GetFileName(registeredIcon), @"^[a-fA-F0-9]{40}\.ico$")) bitmap = ReadSquare(registeredIcon);
                if (bitmap is null && Directory.Exists(folder))
                    foreach (var file in Directory.EnumerateFiles(folder).OrderBy(f => f, StringComparer.Ordinal))
                    {
                        if (!Regex.IsMatch(Path.GetFileName(file), @"^[a-fA-F0-9]{40}\.(jpg|png|ico)$") || new FileInfo(file).Length is <= 0 or > 1024 * 1024) continue;
                        try
                        {
                            var frame = ReadSquare(file); if (frame is null) continue;
                            bitmap = frame; break;
                        }
                        catch (Exception e) when (e is IOException or NotSupportedException or FileFormatException) { }
                    }
            }
            else if (File.Exists(target) && Path.GetExtension(target).ToLowerInvariant() is ".exe" or ".lnk")
            {
                var info = new ShellInfo();
                if (SHGetFileInfo(target, 0, ref info, (uint)Marshal.SizeOf<ShellInfo>(), 0x100) != IntPtr.Zero && info.Icon != IntPtr.Zero)
                {
                    try { bitmap = Imaging.CreateBitmapSourceFromHIcon(info.Icon, Int32Rect.Empty, BitmapSizeOptions.FromEmptyOptions()); }
                    finally { DestroyIcon(info.Icon); }
                }
            }
            if (bitmap is null) return null;
            Directory.CreateDirectory(directory);
            temporary = Path.Combine(directory, Guid.NewGuid().ToString("N") + ".tmp");
            var encoder = new PngBitmapEncoder(); encoder.Frames.Add(BitmapFrame.Create(bitmap));
            using (var output = File.Create(temporary)) encoder.Save(output);
            File.Move(temporary, destination, true);
            return "/covers/" + name;
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or NotSupportedException or FileFormatException or ArgumentException) { return null; }
        finally { if (temporary is not null && File.Exists(temporary)) try { File.Delete(temporary); } catch (IOException) { } }
    }
    static BitmapFrame? ReadSquare(string path)
    {
        if (!File.Exists(path) || new FileInfo(path).Length is <= 0 or > 1024 * 1024) return null;
        using var stream = File.OpenRead(path);
        return BitmapDecoder.Create(stream, BitmapCreateOptions.None, BitmapCacheOption.OnLoad).Frames
            .Where(f => f.PixelWidth is >= 16 and <= 1024 && f.PixelHeight is >= 16 and <= 1024 && Math.Abs(f.PixelWidth - f.PixelHeight) <= 2)
            .OrderByDescending(f => f.PixelWidth).FirstOrDefault();
    }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct ShellInfo
    {
        public IntPtr Icon;
        public int Index;
        public uint Attributes;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string DisplayName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)] public string TypeName;
    }
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)] static extern IntPtr SHGetFileInfo(string path, uint attributes, ref ShellInfo info, uint size, uint flags);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] static extern bool DestroyIcon(IntPtr icon);
}
