# Fluid AI Video Studio — Stage 4

This version upgrades the Stage 3 prototype to a specific **Wan 2.2 A14B image-to-video** Replicate integration. The backend uploads an image to Replicate Files, starts an asynchronous prediction, polls its status, and returns the generated video URL. **No live provider call has been made in this build; a Replicate account/token is required to verify end-to-end generation.**

## Local setup
1. Install Node.js 20+.
2. Extract this ZIP and open a terminal in its folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env` and paste your private `REPLICATE_API_TOKEN`.
5. Keep `STUDIO_ACCESS_KEY` set to a password you choose; enter the same password in the browser.
6. Run `npm start` and open `http://localhost:3000`.
7. Select **AI Image-to-Video**, upload a JPG/PNG/WebP (15 MB max), describe the desired motion, and click Generate.

## Important limitations
- This specific model generates approximately 5-second clips (81 frames at 16 fps), **not** 10/25/60-second AI clips. Duration controls remain for free Motion Studio.
- The model is set to 480p to control test costs. Provider usage is billable; check Replicate pricing before testing.
- The generated video URL is temporary. Download your result promptly.
- AI generation and file upload have not been tested with a real token. Browser mode remains available without an API token.
- Never put your Replicate token in index.html or GitHub Pages. GitHub Pages hosts the frontend only; deploy the backend separately.
- Access key and per-IP rate limit are basic safeguards, **not** a production authentication system. Add user accounts, billing controls, persistent job storage, origin restrictions and anti-abuse protection before a public launch.
- Job IDs are stored in server memory and will be lost on restart. AI videos are not permanently stored.

## API
- `GET /api/health` → online, configured, model
- `POST /api/generate` → multipart `image`, `prompt`; optional `x-studio-key` header
- `GET /api/jobs/:id` → prediction status and output video URL

## Next stage
Stage 5: editing timeline, stitching multiple AI clips, robust MP4 export and video asset storage.
