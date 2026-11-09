using BeeHooks;
using System.Windows;

static class WindowChecks
{
    public static void Run(Action<bool, string> check)
    {
        Exception? failure = null;
        var thread = new Thread(() =>
        {
            try
            {
                var window = new Window { Width = 1280, Height = 800 };
                var fullscreen = new DesktopFullscreen(window);
                fullscreen.Set(true);
                check(fullscreen.Active && window.WindowStyle == WindowStyle.None && window.ResizeMode == ResizeMode.NoResize && window.WindowState == WindowState.Maximized, "desktop fullscreen removes chrome and maximizes");
                fullscreen.Set(true); fullscreen.Set(false);
                check(!fullscreen.Active && window.WindowState == WindowState.Normal && window.WindowStyle == WindowStyle.SingleBorderWindow && window.ResizeMode == ResizeMode.CanResize && window.Width == 1280 && window.Height == 800, "desktop fullscreen restores normal window size and border after repeated entry");
                window.WindowState = WindowState.Maximized;
                fullscreen.Set(true); fullscreen.Set(false);
                check(window.WindowState == WindowState.Maximized, "desktop fullscreen restores an initially maximized window");
                window.WindowState = WindowState.Normal; window.WindowStyle = WindowStyle.ToolWindow; window.ResizeMode = ResizeMode.CanMinimize;
                fullscreen.Set(true); fullscreen.Set(false); fullscreen.Set(false);
                check(window.WindowStyle == WindowStyle.ToolWindow && window.ResizeMode == ResizeMode.CanMinimize, "desktop fullscreen preserves custom window modes and repeated exit");
                window.Close();
            }
            catch (Exception error) { failure = error; }
        });
        thread.SetApartmentState(ApartmentState.STA); thread.Start(); thread.Join();
        if (failure is not null) throw failure;
    }
}
