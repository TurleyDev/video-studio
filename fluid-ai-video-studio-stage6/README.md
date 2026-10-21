# Fluid AI Video Studio — Stage 6

This release packages the **Stage 5 app** for GitHub Pages frontend deployment and a separate Node/FFmpeg backend. **It does not deploy anything to your accounts or verify paid AI generation.**

## 1. Local smoke test (recommended first)

Install Node.js 20+ and FFmpeg. In this folder run:

```powershell
npm install
Copy-Item .env.example .env
# Edit .env: set a long STUDIO_ACCESS_KEY, and optionally REPLICATE_API_TOKEN
npm start
```

Open `http://localhost:3000`. For AI mode use backend URL `http://localhost:3000`; the editor has the same backend URL field. Enter the studio access key from `.env`. Verify `/api/health` responds and test MP4 export with your own short clips. Real AI video requires a working Replicate account/token and costs money; this has not been end-to-end verified.

## 2. Publish static frontend on GitHub Pages

Create a new GitHub repository (e.g. `fluid-ai-video-studio`), upload this project's files to the `main` branch, and open **Settings → Pages → Build and deployment → Source: GitHub Actions**. The included `.github/workflows/pages.yml` publishes only `docs/`. The URL will usually be `https://YOUR_USERNAME.github.io/fluid-ai-video-studio/`. GitHub Pages **cannot** run `server.js`, FFmpeg, or hold a private API token. The static Motion Studio can work without the backend; AI generation and MP4 editing need it.

## 3. Run the backend separately

Use a Node/Docker host that supports persistent processes, FFmpeg, HTTPS, uploads and enough CPU/disk. A `Dockerfile` is provided; build with `docker build -t fluid-video-studio .`. Configure secrets **on the server**, not in GitHub Pages or the repository:

- `REPLICATE_API_TOKEN`: token from Replicate (optional until AI testing)
- `STUDIO_ACCESS_KEY`: long random secret; required for production
- `ALLOWED_ORIGIN`: exact frontend origin, e.g. `https://YOUR_USERNAME.github.io` (origin excludes `/fluid-ai-video-studio/`)
- `PORT`: provider-supplied or 3000

Your host must expose HTTPS. In both pages enter its URL in **Backend URL** and enter your private studio access key. Never put the Replicate token in frontend code or commit `.env`.

## 4. Deployment checks

- GitHub Actions Pages job succeeds and `index.html`/`editor.html` load.
- Backend `/api/health` returns JSON with `online: true`.
- Browser network tab shows CORS requests accepted from your exact Pages origin.
- Wrong access key is rejected; correct key allows upload.
- Local/remote MP4 render works with FFmpeg; verify the output downloads and plays.
- Test one short paid AI generation after confirming provider billing/model availability.

## Known limits before public release

**Private prototype only.** The shared access key is entered in the browser and is not a production multi-user authentication system. There is no user login, billing guardrail, queue isolation, durable job store, persistent media storage, file expiry cleanup, or strong resource controls. Render jobs and AI job mappings live in memory and disappear after a restart; temp files may fill disk. Render operations can be resource-intensive. Do not share your access key or make the backend public for unrestricted use. The MP4 renderer produces silent videos; transitions/audio are not implemented. Do not treat a successful Pages deployment as evidence that AI generation works.
