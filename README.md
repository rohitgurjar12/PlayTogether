# Play Together

Play Together is a small web app for syncing music or YouTube playback between two people in the same room. One user creates or joins a room and shares the link. The app keeps room state synchronized so both sides stay in step while listening.

## Features

- Shared room-based listening experience
- Search and play free audio tracks from Audius and Jamendo
- Optional YouTube video playback
- Real-time room sync with shared playback state
- Invite link generation for quick sharing
- Lightweight static frontend + serverless API setup

## Project structure

- `public/index.html` – frontend UI and client-side sync logic
- `api/search.js` – searches tracks from free music APIs
- `api/stream.js` – resolves a track ID to a streaming URL
- `api/room.js` – stores and syncs room state in Redis
- `api/_jamendo.js` – helper for Jamendo/Audius API requests

## Tech stack

- HTML/CSS/JavaScript frontend
- Serverless API routes in the `api/` folder
- Redis-backed room state via Upstash-compatible REST API
- No build step required for the frontend

## How it works

1. A user opens the app, picks a room name, and joins.
2. The browser creates a shareable invite link.
3. The app periodically polls the room state from the backend.
4. Playback metadata and position are stored per room.
5. When another user joins, the app applies the room state to keep both clients aligned.

## Required environment variables

The app expects the following environment variables to be configured in your hosting environment.

- `REST_API_URL` – base URL for the Redis REST API service
- `REST_API_TOKEN` – access token for that Redis REST API
- `AUDIUS_BEARER_TOKEN` – optional but recommended for Audius requests
- `JAMENDO_CLIENT_ID` – required to enable Jamendo search and playback

The backend checks for these values in `api/room.js`, `api/_audius.js`, and `api/_jamendo.js`.

## Local usage

This project requires a host that supports serverless API functions; serving only the `public/` folder (for example, with VS Code Live Server or GitHub Pages) will make `/api/search` and `/api/stream` return 404. Vercel automatically detects the `api/` functions and serves `public/index.html` at the site root, so no custom routing configuration is needed.

### Option 1: Vercel

1. Push the project to a Git repository.
2. Import it into Vercel.
3. Add the required environment variables.
4. Deploy.

### Option 2: Local dev environment

Use the Vercel development runtime to run the frontend and API functions together. Do not open `public/index.html` directly or use a static-only preview server.

From the project root:

```bash
npx vercel dev
```

Set the environment variables in your Vercel project and pull them for local development with `npx vercel env pull .env.local`, or define them in the shell before starting the development server.

## API behavior

### `GET /api/search?q=...`
Returns a list of matching tracks.

### `GET /api/stream?id=...`
Converts a track ID into a playable audio URL.

### `GET /api/room?room=...&id=...`
Returns peer count and synchronized room state.

### `POST /api/room`
Stores current playback state for the room.

## Notes

- Room names are normalized to a simple lowercase slug to keep URLs predictable.
- Playback state is intentionally kept lightweight so multiple users can stay roughly synchronized.
- Search results depend on the availability of Audius and Jamendo APIs.

## License

This project does not currently include a license file. If you plan to distribute or publish it, add a license that matches your intended usage.
