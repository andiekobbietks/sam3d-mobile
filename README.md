# Sam3D Mobile — Frontend for SAM3D API 🔭📱

**Sam3D Mobile** is an Expo-based frontend app designed to work with the SAM3D-API (SAM 2 segmentation + sam-3d-objects 3D generation). Use it to capture or load images, mark points for segmentation, and request 3D generation (PLY/GIF/GLB) from a running SAM3D API server.

> 🚧 **Note**
>
> This app is intended to be used with the SAM3D-API project: https://github.com/andrisgauracs/sam3d-api

---

## Features ✅

- Capture or pick images and draw/mark points to segment objects using SAM 2
- Request async 3D generation (calls the API's `/generate-3d`, polls `/generate-3d-status`)
- Preview generated GIFs and download/display assets
- Persist and view saved models locally in the app (`/saved-models`)

---

## Quick start — run locally 🛠️

Prerequisites:

- Node.js (16+ recommended)
- npm or yarn
- Expo CLI (optional but useful): `npm i -g expo-cli`

1. Install dependencies

```bash
npm install
```

2. Start Expo

```bash
npx expo start
```

Choose to open in the iOS Simulator, Android emulator, web, or Expo Go on your device.

---

## Configure the SAM3D API endpoint 🔗

The app calls the API using the constant `SAM_API_BASE` defined in `app/lib/api.ts`.

Example (default in this repo):

```ts
// app/lib/api.ts
const SAM_API_BASE = "https://5vjqs0c5nmxrg6-8000.proxy.runpod.net";
```

To use your local or custom API, update that string. Common values:

- Local API (macOS/iOS simulator / web): `http://localhost:8000`
- Android emulator (Android Studio): `http://10.0.2.2:8000`
- Remote server: `https://your-server.example.com`

Note: The app expects the API to implement the following endpoints used by the frontend:

- `POST /segment` and/or `POST /segment-binary` (segmentation)
- `POST /generate-3d` (returns `task_id`)
- `GET /generate-3d-status/{task_id}` (polling for results)
- `GET /assets-list` (optional — list saved mesh/gif assets)

If you want runtime configuration (instead of editing the file), consider adding a small runtime config or env setup and reading it in `app/lib/api.ts`.

---

## Development tips 🔧

- Check the Metro/Expo console for logs when API calls fail — `app/lib/api.ts` logs status and errors.
- For Android emulator networking, prefer `10.0.2.2` to access a host machine's localhost.
- When testing with a local SAM3D-API instance, ensure CORS is configured to accept requests from your app or use the same host/port under development.

---

## Project structure (short)

- `app/` — Expo Router pages and UI
- `app/lib/api.ts` — HTTP helpers that call the SAM3D API
- `app/viewer.tsx` — viewer for generated models/GIFs
- `assets/` — images and static assets

---

## Contributing & links 🔭

If you find issues or want to add features, open an issue or PR here with a short description and steps to reproduce.

---

## License

MIT
