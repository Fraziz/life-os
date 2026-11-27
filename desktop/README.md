# Sariling Mundo — Windows Desktop Wrapper

Standalone Electron wrapper that runs **Sariling Mundo** in its own Windows window with Desktop & Start Menu shortcuts, a System Tray icon, an optional Launch-at-Windows-Startup toggle, and a **Messenger-style Floating Quick-Open Bubble**, staying 100% synced with your live web app.

## Floating Bubble & Edge-Swipe Launcher
- **Circle Bubble**: Always-on-top glowing floating circle with the **Sariling Mundo** logo — drag anywhere on your desktop, click to open/focus or hide the app.
- **Edge Line (Swipe)**: Drag the circle onto the left or right edge of your screen (or switch via right-click) to dock it as a glowing vertical edge bar — hover to peek the logo, click or swipe inward to pop open Sariling Mundo, or drag outward back into a circle.
- **Pill Badge**: Compact `Sariling Mundo` pill with live status indicator (switch styles anytime by right-clicking the bubble or via the Windows System Tray).

## Run Locally
```bash
cd desktop
npm install
npm start
```

## Build Windows Installer (`.exe`) & Portable App
```bash
cd desktop
npm install
npm run build:win
```

Output installers will be generated inside `desktop/dist/`:
- `Sariling Mundo Setup 1.0.0.exe` (Windows installer with Desktop & Start Menu shortcuts)
- `Sariling-Mundo-Portable-1.0.0.exe` (single portable `.exe`)
