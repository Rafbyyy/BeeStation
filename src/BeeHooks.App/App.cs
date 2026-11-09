using System.Windows;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace BeeHooks;

public static class Entry
{
    [STAThread]
    public static void Main(string[] args)
    {
        if (args.Length == 2 && args[0] == "--configure-firewall")
        {
            try { Firewall.Configure(args[1]); MessageBox.Show("Izin BeeStation siap: executable ini, TCP pada port host, jaringan Public/Private, dan subnet lokal saja.", "BeeStation"); }
            catch (Exception e) { MessageBox.Show("Izin belum dibuat: " + e.Message, "BeeStation"); }
            return;
        }
        using var instance = new System.Threading.Mutex(false, @"Local\BeeHooks");
        bool acquired;
        try { acquired = instance.WaitOne(0); } catch (System.Threading.AbandonedMutexException) { acquired = true; }
        if (!acquired) { MessageBox.Show("BeeStation sudah berjalan. Gunakan jendela yang terbuka.", "BeeStation"); return; }
        var app = new Application();
        Host? host = null;
        app.Startup += async (_, _) =>
        {
            try
            {
                host = new Host(); await host.Start();
                if (args.Contains("--host-only"))
                {
                    app.ShutdownMode = ShutdownMode.OnExplicitShutdown;
                    System.IO.File.WriteAllText(System.IO.Path.Combine(Host.DataDirectory, "host-address.txt"), host.AdminUrl);
                    return;
                }
                var view = new WebView2 { CreationProperties = new CoreWebView2CreationProperties { UserDataFolder = System.IO.Path.Combine(Host.DataDirectory, "webview") } };
                var window = new Window { Title = "BeeStation", Icon = System.Windows.Media.Imaging.BitmapFrame.Create(new Uri("pack://application:,,,/Assets/beestation.ico")), Width = 1280, Height = 800, MinWidth = 960, MinHeight = 640, Content = view, Background = System.Windows.Media.Brushes.Black };
                window.Show();
                await view.EnsureCoreWebView2Async();
                view.CoreWebView2.IsMuted = false;
                view.CoreWebView2.Settings.AreDevToolsEnabled = false;
                view.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                view.CoreWebView2.PermissionRequested += (_, e) => e.State = CoreWebView2PermissionState.Deny;
                view.CoreWebView2.NewWindowRequested += (_, e) => e.Handled = true;
                view.CoreWebView2.NavigationStarting += (_, e) => { if (!e.Uri.StartsWith(host.AdminUrl + "/", StringComparison.Ordinal)) e.Cancel = true; };
                var fullscreen = new DesktopFullscreen(window);
                void PublishFullscreen() => view.CoreWebView2.PostWebMessageAsJson(System.Text.Json.JsonSerializer.Serialize(new { type = "desktop-fullscreen", active = fullscreen.Active }));
                void SetFullscreen(bool active) { fullscreen.Set(active); PublishFullscreen(); }
                view.CoreWebView2.WebMessageReceived += (_, e) =>
                {
                    if (!Uri.TryCreate(e.Source, UriKind.Absolute, out var source) || source.GetLeftPart(UriPartial.Authority) != host.AdminUrl || source.AbsolutePath is not ("/" or "/index.html")) return;
                    switch (e.WebMessageAsJson)
                    {
                        case "\"fullscreen:toggle\"": SetFullscreen(!fullscreen.Active); break;
                        case "\"fullscreen:state\"": PublishFullscreen(); break;
                    }
                };
                window.PreviewKeyDown += (_, e) =>
                {
                    if (System.Windows.Input.Keyboard.Modifiers != System.Windows.Input.ModifierKeys.None) return;
                    bool toggle = e.Key == System.Windows.Input.Key.F11;
                    if (!toggle && !(e.Key == System.Windows.Input.Key.Escape && fullscreen.Active)) return;
                    e.Handled = true;
                    if (!e.IsRepeat) window.Dispatcher.BeginInvoke(() => SetFullscreen(toggle && !fullscreen.Active));
                };
                view.Source = new Uri(host.AdminUrl + "/");
            }
            catch (Exception error)
            {
                System.IO.Directory.CreateDirectory(Host.DataDirectory);
                System.IO.File.WriteAllText(System.IO.Path.Combine(Host.DataDirectory, "startup-error.txt"), error.ToString());
                MessageBox.Show("BeeStation belum dapat dibuka. Rincian ada di startup-error.txt dalam folder simpanan.\n\n" + error.Message, "BeeStation", MessageBoxButton.OK, MessageBoxImage.Error);
                host?.Dispose(); app.Shutdown(1);
            }
        };
        app.Exit += (_, _) => host?.Dispose();
        try { app.Run(); } finally { instance.ReleaseMutex(); }
    }
}
