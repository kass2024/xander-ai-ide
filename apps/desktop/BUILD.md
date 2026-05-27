# Xander AI IDE — Desktop Build Notes

## Windows requirements

### node-pty (integrated terminal)

The integrated terminal uses `node-pty`, a native Node addon. On Windows it must be rebuilt for Electron:

```powershell
npm install
npm run rebuild:pty
```

If rebuild fails, install **Visual Studio Build Tools** with the **Desktop development with C++** workload, then retry.

When rebuild is unavailable, the app falls back to a spawn-based terminal (still functional, without full PTY features).

### Build installers

```powershell
npm run build          # compile only
npm run dist:win       # NSIS installer + portable EXE
npm run dist:portable    # portable EXE only
```

Outputs land in `apps/desktop/release/`:

- `Xander AI IDE-1.0.0-x64.exe` — NSIS installer
- `Xander AI IDE-Portable-1.0.0.exe` — portable (no install)

## Debugging (F5)

1. Open a project folder
2. Optionally add `.vscode/launch.json` configurations
3. Click the gutter to set breakpoints
4. Press **F5** (Run → Start Debugging)

Node.js runs with `--inspect-brk=9229`. Attach via Chrome at `chrome://inspect`.
Python uses `debugpy` on port 5678 if installed.
