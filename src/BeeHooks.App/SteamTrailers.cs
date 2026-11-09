using System.Globalization;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;

[assembly: InternalsVisibleTo("BeeHooks.Checks")]

namespace BeeHooks;

public static class SteamTrailers
{
    const long MaxVideoBytes = 48 * 1024 * 1024;
    static readonly SemaphoreSlim Gate = new(1, 1);
    static readonly HttpClient Client = new(new SocketsHttpHandler { AllowAutoRedirect = false, ConnectTimeout = TimeSpan.FromSeconds(8) }) { Timeout = TimeSpan.FromSeconds(20) };

    public static Task<string?> EnsureAsync(string target, string coversDirectory, CancellationToken cancellationToken = default) => EnsureAsync(target, coversDirectory, Client, cancellationToken);
    public static Task<string?> EnsureAudioAsync(string target, string coversDirectory, CancellationToken cancellationToken = default) => EnsureAsync(target, coversDirectory, Client, cancellationToken, audio: true);

    internal static async Task<string?> EnsureAsync(string target, string coversDirectory, HttpClient client, CancellationToken cancellationToken = default, bool audio = false)
    {
        var match = Regex.Match(target, @"^steam://rungameid/([0-9]{1,12})$");
        if (!match.Success) return null;
        var id = match.Groups[1].Value;
        var filename = "steam-" + id + (audio ? "-audio.m4a" : "-1080.mp4");
        var destination = Path.Combine(coversDirectory, filename);
        var url = "/covers/" + filename;
        string? temporary = null;
        bool entered = false;
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(45));
        try
        {
            if (ValidCache(destination)) return url;
            await Gate.WaitAsync(timeout.Token); entered = true;
            if (ValidCache(destination)) return url;
            var metadata = await ReadText(client, new Uri("https://store.steampowered.com/api/appdetails?appids=" + id + "&filters=movies&l=english"), timeout.Token);
            using var json = JsonDocument.Parse(metadata);
            if (!json.RootElement.TryGetProperty(id, out var app) || !app.TryGetProperty("success", out var success) || !success.GetBoolean() || !app.TryGetProperty("data", out var data) || !data.TryGetProperty("movies", out var movies) || movies.ValueKind != JsonValueKind.Array) return null;
            List<Uri>? plan = null;
            foreach (var movie in movies.EnumerateArray())
            {
                if (movie.TryGetProperty("mp4", out var mp4) && mp4.TryGetProperty("480", out var small) && SteamUri(small.GetString()) is { } progressive) { if (audio) return null; plan = [progressive]; break; }
                if (movie.TryGetProperty("dash_h264", out var dash) && SteamUri(dash.GetString()) is { } manifest)
                {
                    plan = DashPreview(await ReadText(client, manifest, timeout.Token), manifest, audio);
                    if (plan is not null) break;
                }
            }
            if (plan is null) return null;
            Directory.CreateDirectory(coversDirectory);
            temporary = Path.Combine(coversDirectory, ".steam-" + id + "-" + Guid.NewGuid().ToString("N") + ".tmp");
            await using (var file = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, 65536, FileOptions.Asynchronous))
            {
                var buffer = new byte[65536];
                foreach (var media in plan)
                {
                    using var response = await client.GetAsync(media, HttpCompletionOption.ResponseHeadersRead, timeout.Token);
                    response.EnsureSuccessStatusCode();
                    var type = response.Content.Headers.ContentType?.MediaType;
                    if (response.Content.Headers.ContentLength > MaxVideoBytes - file.Length || !(type == "application/octet-stream" || type == "video/mp4" || audio && type == "audio/mp4")) return null;
                    await using var input = await response.Content.ReadAsStreamAsync(timeout.Token);
                    int count;
                    while ((count = await input.ReadAsync(buffer, timeout.Token)) != 0)
                    {
                        if (file.Length + count > MaxVideoBytes) return null;
                        await file.WriteAsync(buffer.AsMemory(0, count), timeout.Token);
                    }
                }
                await file.FlushAsync(timeout.Token);
            }
            if (!ValidCache(temporary)) return null;
            File.Move(temporary, destination, true);
            return url;
        }
        catch (Exception e) when (e is HttpRequestException or IOException or UnauthorizedAccessException or OperationCanceledException or JsonException or XmlException or FormatException or InvalidOperationException) { return null; }
        finally
        {
            if (temporary is not null) try { File.Delete(temporary); } catch (Exception e) when (e is IOException or UnauthorizedAccessException) { }
            if (entered) Gate.Release();
        }
    }

    static bool ValidCache(string path)
    {
        if (!File.Exists(path) || new FileInfo(path).Length is < 12 or > MaxVideoBytes) return false;
        using var stream = File.OpenRead(path);
        Span<byte> header = stackalloc byte[8];
        return stream.Read(header) == 8 && header[4..].SequenceEqual("ftyp"u8);
    }

    static Uri? SteamUri(string? text)
    {
        if (!Uri.TryCreate(text, UriKind.Absolute, out var uri) || uri.Scheme != "https" || !uri.IsDefaultPort || uri.UserInfo.Length != 0) return null;
        return uri.Host.EndsWith(".steamstatic.com", StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith(".steamcontent.com", StringComparison.OrdinalIgnoreCase) ? uri : null;
    }

    static async Task<byte[]> ReadText(HttpClient client, Uri url, CancellationToken token)
    {
        using var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, token);
        response.EnsureSuccessStatusCode();
        if (response.Content.Headers.ContentLength > 1024 * 1024) throw new IOException("Metadata size limit.");
        await using var input = await response.Content.ReadAsStreamAsync(token);
        using var output = new MemoryStream();
        var buffer = new byte[8192]; int count;
        while ((count = await input.ReadAsync(buffer, token)) != 0) { if (output.Length + count > 1024 * 1024) throw new IOException("Metadata size limit."); output.Write(buffer, 0, count); }
        return output.ToArray();
    }

    static List<Uri>? DashPreview(byte[] bytes, Uri manifest, bool audio)
    {
        using var reader = XmlReader.Create(new MemoryStream(bytes), new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 1024 * 1024 });
        var root = XDocument.Load(reader).Root!; XNamespace ns = root.Name.Namespace;
        var representation = root.Descendants(ns + "AdaptationSet").Where(a => (string?)a.Attribute("contentType") == (audio ? "audio" : "video")).SelectMany(a => a.Elements(ns + "Representation"))
            .Where(r => (string?)r.Attribute("mimeType") == (audio ? "audio/mp4" : "video/mp4") && Regex.IsMatch((string?)r.Attribute("id") ?? "", @"^[0-9]{1,4}$") && (audio || int.TryParse((string?)r.Attribute("height"), out var h) && h > 0))
            .OrderBy(r => audio ? 0 : Math.Abs(int.Parse(r.Attribute("height")!.Value, CultureInfo.InvariantCulture) - 1080)).FirstOrDefault();
        if (representation is null) return null;
        var template = representation.Element(ns + "SegmentTemplate") ?? representation.Parent?.Element(ns + "SegmentTemplate");
        if (template?.Attribute("initialization") is null || template.Attribute("media") is null) return null;
        var id = representation.Attribute("id")!.Value;
        int start = int.TryParse((string?)template.Attribute("startNumber"), out var number) ? number : 1;
        if (start is < 0 or > 1000000) return null;
        int segments = 6;
        if (root.Attribute("mediaPresentationDuration") is { } duration && double.TryParse((string?)template.Attribute("duration"), out var ticks) && double.TryParse((string?)template.Attribute("timescale"), out var scale) && double.IsFinite(ticks) && double.IsFinite(scale) && ticks > 0 && scale > 0)
            segments = (int)Math.Clamp(Math.Ceiling(XmlConvert.ToTimeSpan(duration.Value).TotalSeconds / (ticks / scale)), 1, 6);
        // Matching video/audio fragments provide a short preview without a media framework or transcoder.
        string Expand(string value, int n) => value.Replace("$RepresentationID$", id).Replace("$Number%05d$", n.ToString("D5", CultureInfo.InvariantCulture)).Replace("$Number$", n.ToString(CultureInfo.InvariantCulture));
        var names = new[] { Expand(template.Attribute("initialization")!.Value, start) }.Concat(Enumerable.Range(start, segments).Select(n => Expand(template.Attribute("media")!.Value, n)));
        var plan = new List<Uri>();
        foreach (var name in names) { if (name.Contains('$') || !Uri.TryCreate(manifest, name, out var uri) || SteamUri(uri.AbsoluteUri) is null) return null; plan.Add(uri); }
        return plan;
    }
}
