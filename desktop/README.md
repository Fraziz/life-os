# Sariling Mundo — Windows Desktop Wrapper

Standalone Electron wrapper that runs **Sariling Mundo** in its own Windows window with Desktop & Start Menu shortcuts, a System Tray icon, and an optional Launch-at-Windows-Startup toggle, staying 100% synced with your live web app.

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
