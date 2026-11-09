using System.Windows;

namespace BeeHooks;

public sealed class DesktopFullscreen(Window window)
{
    WindowState previousState;
    WindowStyle previousStyle;
    ResizeMode previousResize;
    public bool Active { get; private set; }

    public void Set(bool active)
    {
        if (Active == active) return;
        if (active)
        {
            previousState = window.WindowState;
            previousStyle = window.WindowStyle;
            previousResize = window.ResizeMode;
            window.WindowState = WindowState.Normal;
            window.WindowStyle = WindowStyle.None;
            window.ResizeMode = ResizeMode.NoResize;
            window.WindowState = WindowState.Maximized;
        }
        else
        {
            window.WindowState = WindowState.Normal;
            window.WindowStyle = previousStyle;
            window.ResizeMode = previousResize;
            window.WindowState = previousState;
        }
        Active = active;
    }
}
