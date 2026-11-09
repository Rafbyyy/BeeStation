using BeeHooks.Core;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace BeeHooks;

public static partial class GameFiles
{
    public static string? SteamPath()
    {
        using var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam");
        return key?.GetValue("SteamPath") as string;
    }
    public static string? CacheSteamCover(string target, string? steam, string covers, bool portrait = false)
    {
        var match = Regex.Match(target, @"^steam://rungameid/(\d{1,12})$");
        if (!match.Success || steam is null) return null;
        var id = match.Groups[1].Value;
        var name = "steam-" + id + (portrait ? "-poster" : "") + ".jpg";
        var destination = Path.Combine(covers, name);
        var url = "/covers/" + name;
        string? temporary = null;
        try
        {
            if (File.Exists(destination) && new FileInfo(destination).Length is > 0 and <= 8 * 1024 * 1024) return url;
            var cache = Path.Combine(steam, "appcache", "librarycache");
            // shortcut: use local Steam artwork; add an online provider if offline cache coverage is insufficient.
            var source = (portrait ? new[] { Path.Combine(cache, id, "library_600x900.jpg"), Path.Combine(cache, id + "_library_600x900.jpg") } : new[] { Path.Combine(cache, id, "library_hero.jpg"), Path.Combine(cache, id + "_library_hero.jpg"), Path.Combine(cache, id, "header.jpg"), Path.Combine(cache, id + "_header.jpg"), Path.Combine(cache, id, "library_600x900.jpg"), Path.Combine(cache, id + "_library_600x900.jpg") })
                .FirstOrDefault(path => File.Exists(path) && new FileInfo(path).Length is > 0 and <= 8 * 1024 * 1024);
            if (source is null) return null;
            Directory.CreateDirectory(covers);
            temporary = Path.Combine(covers, Guid.NewGuid().ToString("N") + ".tmp");
            File.Copy(source, temporary);
            if (new FileInfo(temporary).Length > 8 * 1024 * 1024) return null;
            using (var stream = File.OpenRead(temporary))
            {
                var image = System.Windows.Media.Imaging.BitmapDecoder.Create(stream, System.Windows.Media.Imaging.BitmapCreateOptions.None, System.Windows.Media.Imaging.BitmapCacheOption.OnLoad);
                if (portrait && image.Frames[0].PixelWidth >= image.Frames[0].PixelHeight) return null;
                if (image.Frames[0].PixelWidth > 8192 || image.Frames[0].PixelHeight > 8192) return null;
            }
            File.Move(temporary, destination, true);
            return url;
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or NotSupportedException or System.IO.FileFormatException) { return null; }
        finally { if (temporary is not null && File.Exists(temporary)) try { File.Delete(temporary); } catch (Exception e) when (e is IOException or UnauthorizedAccessException) { } }
    }
    public static string ValidateTarget(string target)
    {
        if (Regex.IsMatch(target, @"^steam://rungameid/\d{1,12}$")) return target;
        if (target.StartsWith("com.epicgames.launcher://apps/", StringComparison.Ordinal) && Uri.TryCreate(target, UriKind.Absolute, out _) && target.Length < 2048 && !target.Any(char.IsControl)) return target;
        var full = Path.GetFullPath(target);
        if (!File.Exists(full) || !new[] { ".exe", ".lnk", ".url" }.Contains(Path.GetExtension(full).ToLowerInvariant())) throw new ArgumentException("Pilih executable atau shortcut game yang tersedia.");
        if (Path.GetExtension(full).Equals(".url", StringComparison.OrdinalIgnoreCase))
        {
            var url = File.ReadLines(full).FirstOrDefault(l => l.StartsWith("URL=", StringComparison.OrdinalIgnoreCase))?[4..].Trim() ?? "";
            if (!url.StartsWith("steam://rungameid/", StringComparison.Ordinal) && !url.StartsWith("com.epicgames.launcher://apps/", StringComparison.Ordinal)) throw new ArgumentException("Shortcut URL harus milik Steam atau Epic.");
            return ValidateTarget(url);
        }
        return full;
    }
    public static bool Exists(string target) { try { ValidateTarget(target); return true; } catch { return false; } }
    public static void Launch(GameEntry game)
    {
        var target = ValidateTarget(game.Target);
        Process.Start(new ProcessStartInfo(target) { UseShellExecute = true, WorkingDirectory = Path.IsPathFullyQualified(target) ? Path.GetDirectoryName(target)! : "" });
    }
    public static object[] Discover()
    {
        var results = new List<object>();
        var steam = SteamPath();
        if (steam is not null)
        {
            var roots = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { steam };
            var folders = Path.Combine(steam, "steamapps", "libraryfolders.vdf");
            if (File.Exists(folders)) foreach (Match m in Regex.Matches(File.ReadAllText(folders), "\"path\"\\s*\"([^\"]+)\"")) roots.Add(m.Groups[1].Value.Replace("\\\\", "\\"));
            foreach (var root in roots)
            {
                var apps = Path.Combine(root, "steamapps"); if (!Directory.Exists(apps)) continue;
                foreach (var manifest in Directory.EnumerateFiles(apps, "appmanifest_*.acf"))
                {
                    var text = File.ReadAllText(manifest);
                    string Value(string key) => Regex.Match(text, "\"" + key + "\"\\s*\"([^\"]+)\"").Groups[1].Value;
                    var id = Value("appid"); var installed = Path.Combine(apps, "common", Value("installdir"));
                    if (Regex.IsMatch(id, @"^\d+$") && Directory.Exists(installed)) results.Add(new { name = Value("name"), target = "steam://rungameid/" + id, platform = "Steam", build = Value("buildid") });
                }
            }
        }
        var epic = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Epic", "EpicGamesLauncher", "Data", "Manifests");
        if (Directory.Exists(epic)) foreach (var file in Directory.EnumerateFiles(epic, "*.item"))
        {
            try
            {
                using var json = JsonDocument.Parse(File.ReadAllBytes(file)); var r = json.RootElement;
                var name = r.GetProperty("DisplayName").GetString(); var id = r.GetProperty("AppName").GetString(); var location = r.GetProperty("InstallLocation").GetString();
                if (Directory.Exists(location)) results.Add(new { name, target = "com.epicgames.launcher://apps/" + Uri.EscapeDataString(id!) + "?action=launch&silent=true", platform = "Epic", build = "" });
            }
            catch (Exception e) when (e is JsonException or KeyNotFoundException) { }
        }
        return results.DistinctBy(r => JsonSerializer.Serialize(r)).ToArray();
    }
}
