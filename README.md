# MeshPit

MeshPit is a cross-platform (macOS, Windows, Linux) desktop app for managing your library of
3D-printable files (`.stl`, `.obj`, `.3mf`). It indexes chosen folders in the background,
generates thumbnail previews, and lets you search, tag, collect, and open files directly in
Bambu Studio — all in a dark, purple-accented UI.

## Features

- **Background indexing** — recursive folder scanning runs on a `worker_thread` (lowered OS
  scheduling priority where supported) so it never blocks the UI or steals foreground CPU time.
- **Thumbnail gallery** — STL/OBJ/3MF geometry is rendered to PNG previews using three.js in a
  hidden offscreen window, cached to disk, and shown in a searchable grid.
- **Search & sort** — filter by name, folder, collection, or tag; sort by name, size, date
  added, or date modified.
- **Tags & collections** — freeform tags plus named collections for organizing your library.
- **Bambu Studio integration** — double-click a file (or use the details panel) to open it
  directly in Bambu Studio; falls back to the OS default handler if no path is configured.
- **Library management** — remove files from the index only, or permanently delete them from
  disk, with a confirmation step either way.

## Tech stack

- Electron + `electron-vite` + React + TypeScript
- `better-sqlite3` for the local index database
- `three.js` for headless thumbnail rendering
- Node `worker_threads` for background directory scanning

## Getting started

```bash
npm install
npm run dev      # start in development mode
npm run build    # production build (out/)
npm run dist:mac # package a macOS .dmg (also: dist:win, dist:linux)
```

On first run, use **+ Add Folder** in the sidebar to choose a directory to index. Set the path
to your Bambu Studio installation under **Settings** to enable one-click opening.
