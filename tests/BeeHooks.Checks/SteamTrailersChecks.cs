using BeeHooks;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

public static class SteamTrailersChecks
{
    public static async Task Run(Action<bool, string> ok)
    {
        var directory = Path.Combine(Path.GetTempPath(), "BeeStation-trailer-check-" + Guid.NewGuid());
        Directory.CreateDirectory(directory);
        var video = new byte[] { 0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115, 111, 109, 97, 118, 99, 49 };
        const string target = "steam://rungameid/42", trusted = "https://video.akamai.steamstatic.com/clip.mp4";
        string Metadata(object movie) => JsonSerializer.Serialize(new Dictionary<string, object> { ["42"] = new { success = true, data = new { movies = new[] { movie } } } });
        string Progressive(string url) => Metadata(new { mp4 = new Dictionary<string, string> { ["480"] = url } });
        HttpResponseMessage Text(string value) => new(HttpStatusCode.OK) { Content = new StringContent(value) };
        HttpResponseMessage Media(byte[] bytes, string type = "video/mp4") { var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(bytes) }; response.Content.Headers.ContentType = new MediaTypeHeaderValue(type); return response; }
        try
        {
            using var reject = new HttpClient(new FakeHandler(_ => throw new HttpRequestException("offline")));
            ok(await SteamTrailers.EnsureAsync("steam://rungameid/../../private", directory, reject) is null && await SteamTrailers.EnsureAsync("com.epicgames.launcher://apps/example", directory, reject) is null, "trailers reject invalid and non-Steam targets before network access");
            foreach (var bad in new[] { "https://evilsteamstatic.com/clip.mp4", "http://video.akamai.steamstatic.com/clip.mp4", "https://video.akamai.steamstatic.com:444/clip.mp4", "https://user@video.akamai.steamstatic.com/clip.mp4" })
            {
                var handler = new FakeHandler(_ => Text(Progressive(bad))); using var client = new HttpClient(handler);
                ok(await SteamTrailers.EnsureAsync(target, Path.Combine(directory, "untrusted"), client) is null && handler.Calls == 1, "trailer URL trust boundary rejects " + new Uri(bad).GetComponents(UriComponents.SchemeAndServer, UriFormat.SafeUnescaped));
            }
            var oversize = new FakeHandler(request => { if (request.RequestUri!.Host == "store.steampowered.com") return Text(Progressive(trusted)); var response = Media(video); response.Content.Headers.ContentLength = 48 * 1024 * 1024 + 1; return response; });
            using (var client = new HttpClient(oversize)) ok(await SteamTrailers.EnsureAsync(target, Path.Combine(directory, "oversize"), client) is null, "trailer download rejects oversized Content-Length");
            var wrongType = new FakeHandler(request => request.RequestUri!.Host == "store.steampowered.com" ? Text(Progressive(trusted)) : Media(video, "text/html"));
            using (var client = new HttpClient(wrongType)) ok(await SteamTrailers.EnsureAsync(target, Path.Combine(directory, "type"), client) is null, "trailer download rejects non-video response types");
            var invalid = new FakeHandler(request => request.RequestUri!.Host == "store.steampowered.com" ? Text(Progressive(trusted)) : Media(Encoding.UTF8.GetBytes("not a valid MP4 file")));
            using (var client = new HttpClient(invalid)) ok(await SteamTrailers.EnsureAsync(target, Path.Combine(directory, "invalid"), client) is null && !Directory.EnumerateFiles(Path.Combine(directory, "invalid")).Any(), "invalid MP4 signature leaves no cached or temporary file");
            var redirected = new FakeHandler(request => { if (request.RequestUri!.Host == "store.steampowered.com") return Text(Progressive(trusted)); var response = new HttpResponseMessage(HttpStatusCode.Redirect); response.Headers.Location = new Uri("https://untrusted.example/video.mp4"); return response; });
            using (var client = new HttpClient(redirected)) ok(await SteamTrailers.EnsureAsync(target, Path.Combine(directory, "redirect"), client) is null && redirected.Calls == 2, "trailer redirects are not followed");
            var valid = new FakeHandler(request => request.RequestUri!.Host == "store.steampowered.com" ? Text(Progressive(trusted)) : Media(video));
            var cached = Path.Combine(directory, "cached");
            using (var client = new HttpClient(valid))
            {
                var results = await Task.WhenAll(SteamTrailers.EnsureAsync(target, cached, client), SteamTrailers.EnsureAsync(target, cached, client));
                ok(results.All(result => result == "/covers/steam-42-1080.mp4") && valid.Calls == 2 && File.ReadAllBytes(Path.Combine(cached, "steam-42-1080.mp4")).SequenceEqual(video), "concurrent trailer requests share one bounded download and preserve bytes");
            }
            ok(await SteamTrailers.EnsureAsync(target, cached, reject) == "/covers/steam-42-1080.mp4", "valid local trailer cache works while offline");
            const string manifest = "<MPD xmlns='urn:mpeg:dash:schema:mpd:2011' mediaPresentationDuration='PT18S'><Period><AdaptationSet contentType='video'><Representation id='2' mimeType='video/mp4' height='480'><SegmentTemplate timescale='1' duration='3' initialization='init-$RepresentationID$.m4s' media='chunk-$RepresentationID$-$Number%05d$.m4s' startNumber='1'/></Representation></AdaptationSet></Period></MPD>";
            var dash = new FakeHandler(request => request.RequestUri!.Host == "store.steampowered.com" ? Text(Metadata(new { dash_h264 = "https://video.akamai.steamstatic.com/trailer/manifest.mpd" })) : request.RequestUri.AbsolutePath.EndsWith(".mpd") ? Text(manifest) : Media(request.RequestUri.AbsolutePath.Contains("init-") ? video : [1, 2, 3, 4]));
            var dashCache = Path.Combine(directory, "dash");
            using (var client = new HttpClient(dash)) ok(await SteamTrailers.EnsureAsync(target, dashCache, client) == "/covers/steam-42-1080.mp4" && dash.Calls == 9 && new FileInfo(Path.Combine(dashCache, "steam-42-1080.mp4")).Length == video.Length + 24, "current Steam DASH metadata produces a six-fragment preview at the best available resolution");
            var hdManifest = manifest.Replace("<Representation id='2'", "<Representation id='0' mimeType='video/mp4' height='1080'><SegmentTemplate timescale='1' duration='3' initialization='init-$RepresentationID$.m4s' media='chunk-$RepresentationID$-$Number%05d$.m4s' startNumber='1'/></Representation><Representation id='2'");
            var hd = new FakeHandler(request => request.RequestUri!.Host == "store.steampowered.com" ? Text(Metadata(new { dash_h264 = "https://video.akamai.steamstatic.com/trailer/manifest.mpd" })) : request.RequestUri.AbsolutePath.EndsWith(".mpd") ? Text(hdManifest) : Media(request.RequestUri.AbsolutePath.Contains("init-") ? video : request.RequestUri.AbsolutePath.Contains("chunk-0-") ? [8, 9] : [0]));
            var hdCache = Path.Combine(directory, "hd");Directory.CreateDirectory(hdCache);File.WriteAllBytes(Path.Combine(hdCache, "steam-42.mp4"), video);
            using (var client = new HttpClient(hd)) ok(await SteamTrailers.EnsureAsync(target, hdCache, client) == "/covers/steam-42-1080.mp4" && File.ReadAllBytes(Path.Combine(hdCache, "steam-42-1080.mp4")).SequenceEqual(video.Concat(Enumerable.Repeat(new byte[] { 8, 9 }, 6).SelectMany(bytes => bytes))), "1080p representation replaces the legacy 480p cache without reusing its filename");
            var audioManifest = manifest.Replace("</Period>", "<AdaptationSet contentType='audio'><Representation id='4' mimeType='audio/mp4'><SegmentTemplate timescale='1' duration='3' initialization='init-$RepresentationID$.m4s' media='chunk-$RepresentationID$-$Number%05d$.m4s' startNumber='1'/></Representation></AdaptationSet></Period>");
            var audioHandler = new FakeHandler(request => request.RequestUri!.Host == "store.steampowered.com" ? Text(Metadata(new { dash_h264 = "https://video.akamai.steamstatic.com/trailer/manifest.mpd" })) : request.RequestUri.AbsolutePath.EndsWith(".mpd") ? Text(audioManifest) : Media(request.RequestUri.AbsolutePath.Contains("init-") ? video : request.RequestUri.AbsolutePath.Contains("chunk-4-") ? [5, 6, 7, 8] : [0], "audio/mp4"));
            using (var client = new HttpClient(audioHandler)) ok(await SteamTrailers.EnsureAsync(target, dashCache, client, audio: true) == "/covers/steam-42-audio.m4a" && audioHandler.Calls == 9 && File.ReadAllBytes(Path.Combine(dashCache, "steam-42-audio.m4a")).SequenceEqual(video.Concat(Enumerable.Repeat(new byte[] { 5, 6, 7, 8 }, 6).SelectMany(bytes => bytes))), "trailer audio selects matching AAC fragments and caches separately from video");
            ok(await SteamTrailers.EnsureAsync(target, dashCache, reject, audio: true) == "/covers/steam-42-audio.m4a" && new FileInfo(Path.Combine(dashCache, "steam-42-1080.mp4")).Length == video.Length + 24, "audio cache works offline without replacing the existing video preview");
            var missingAudio = new FakeHandler(request => request.RequestUri!.Host == "store.steampowered.com" ? Text(Metadata(new { dash_h264 = "https://video.akamai.steamstatic.com/trailer/manifest.mpd" })) : Text(manifest));
            using (var client = new HttpClient(missingAudio)) ok(await SteamTrailers.EnsureAsync(target, Path.Combine(directory, "no-audio"), client, audio: true) is null && missingAudio.Calls == 2, "video-only trailers do not download an unrelated audio track");
            var inlineAudio = new FakeHandler(_ => Text(Progressive(trusted)));
            using (var client = new HttpClient(inlineAudio)) ok(await SteamTrailers.EnsureAsync(target, Path.Combine(directory, "inline-audio"), client, audio: true) is null && inlineAudio.Calls == 1, "progressive trailers retain their inline audio without a duplicate download");
            ok(!Directory.EnumerateFiles(directory, "*.tmp", SearchOption.AllDirectories).Any(), "trailer cache leaves no temporary files");
        }
        finally { Directory.Delete(directory, true); }
    }

    sealed class FakeHandler(Func<HttpRequestMessage, HttpResponseMessage> response) : HttpMessageHandler
    {
        public int Calls;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) { Calls++; await Task.Delay(1, cancellationToken); return response(request); }
    }
}
