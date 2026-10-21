# Fluid AI Video Studio — Stage 5

## New: MP4 timeline editor

The original Stage 4 studio is preserved in `index.html`. Open `editor.html` (or click the timeline editor link in the studio) to upload, trim, reorder and join video clips into an H.264 MP4. The editor also imports a completed AI generation by its prediction ID while the same server process is running.

## Requirements

- Node.js 20+
- FFmpeg installed and available on PATH (`ffmpeg -version`), or set `FFMPEG_PATH` to its executable.
- Run `npm install`, copy `.env.example` to `.env`, set `STUDIO_ACCESS_KEY`, optionally `REPLICATE_API_TOKEN`, then `npm start`.
- Open http://localhost:3000/editor.html

## Limitations

- This release exports **silent** MP4s; audio mixing, transitions and background music are not implemented.
- Uploads and completed renders are stored temporarily on the server and not cleaned automatically; this is a local prototype, not a hardened multi-user production service.
- Clip metadata is held in server memory, so restarting loses clip/job IDs.
- FFmpeg must be installed separately; GitHub Pages cannot run the Node backend or FFmpeg.
- Real AI generation still requires a funded/configured provider and live testing.
- For remote deployments, use HTTPS, private authentication, upload quotas and persistent storage.
