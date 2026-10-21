# Fluid AI Video Studio — Stage 3

## What works
- Existing Stage 2 free animated motion graphics and WebM recording.
- New AI Image-to-Video tab with image/prompt submission, job status polling, video playback, and link to download provider output.
- Optional Node.js server integrates with Replicate predictions API. **No model is bundled and no AI generation happens until configured.**

## Run locally
1. Install Node.js 20+.
2. In this folder run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `REPLICATE_API_TOKEN` and `REPLICATE_MODEL_VERSION` for a **Replicate image-to-video model**. Check that model's current input schema. Set `REPLICATE_IMAGE_FIELD` to its image field (e.g. `image`, `start_image`, or `input_image`). The sample sends `prompt` and that image field. Some models require additional fields or a different endpoint; adapt `server.js` accordingly.
5. Run `npm start` and visit `http://localhost:3000`.
6. Choose **AI Image-to-Video**, upload an image, enter a prompt, and click Generate.

## GitHub Pages
GitHub Pages can host `index.html` and its free browser animation features, but **cannot host `server.js`**. Deploy the Node server separately on a secure HTTPS host, set `ALLOWED_ORIGIN` to your Pages origin, and enter its HTTPS URL in the AI backend field. Never commit `.env` or place API tokens in HTML. The service may incur usage charges. For public deployment, add authentication, quotas, and rate limiting before enabling generation; otherwise strangers could spend your credits.

## Limitations
- Realistic motion depends on your chosen model; this code is an integration, not a trained AI model.
- Some models do not accept 10/25/60-second durations or requested aspect ratios. These UI settings are not passed to the provider until a compatible model-specific mapping is implemented.
- Provider output may be MP4 or another format; download is a direct provider link and may expire or be blocked by cross-origin policies. The sample does not store finished videos permanently.
- Browser mode still exports WebM, not MP4.
