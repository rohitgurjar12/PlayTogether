# Play With Me

Play With Me is a small web app for syncing music or YouTube playback between two people in the same room. One user creates or joins a room and shares the link. The app keeps room state synchronized so both sides stay in step while listening.

## Features

- Shared room-based listening experience
- Search and play free audio tracks from Audius and Jamendo
- Synchronized YouTube playback
- In-room chat, quick emoji reactions, and edit/delete controls for your own messages
- Real-time room and playback sync backed by Redis
- Invite link generation for quick sharing
- Responsive, animated interface for desktop and mobile
- Lightweight frontend with serverless API routes

## Project structure

- `public/index.html` – frontend UI and client-side sync logic
- `api/search.js` – searches tracks from free music APIs
- `api/stream.js` – resolves a track ID to a streaming URL
- `api/room.js` – stores playback state, room presence, chat, and reactions in Redis
- `api/_audius.js` – Audius API helper
- `api/_jamendo.js` – Jamendo API helper

## Tech stack

- HTML/CSS/JavaScript frontend
- Serverless API routes in the `api/` folder
- Redis REST API for room state and chat (Upstash-compatible)
- Audius and Jamendo for audio search and streaming
- YouTube IFrame Player API for video playback
- No build step required for the frontend

## How it works

1. A user opens the app, picks a room name, and joins.
2. The browser creates a shareable invite link.
3. The app periodically polls the room API for playback state, participants, and chat.
4. Playback updates and up to 50 chat messages per room are stored in Redis; chat expires after 24 hours.
5. Users can edit or delete their own text messages. Changes appear for other room members on the next poll.

## Required environment variables

Configure these in `.env.local` for local development and in your hosting provider for deployment:

- `UPSTASH_REDIS_REST_URL` – Redis REST API URL; `REST_API_URL` and `REST_URL` are also accepted
- `UPSTASH_REDIS_REST_TOKEN` – Redis REST API token; `REST_API_TOKEN` and `REST_TOKEN` are also accepted
- `AUDIUS_BEARER_TOKEN` – optional but recommended for Audius requests
- `JAMENDO_CLIENT_ID` – required to enable Jamendo search and playback

Keep `.env.local` and all tokens private; do not commit them. `.env.local` is excluded by `.gitignore`.

## Run locally

The app needs a serverless-functions runtime. VS Code Go Live, opening `public/index.html` directly, and static-only hosts such as GitHub Pages do not run the API routes, so search, chat, and room sync will fail there.

1. Install Node.js.
2. Add your development environment variables to `.env.local` in the project root.
3. From the project root, start Vercel's local runtime:

   ```bash
   npx vercel dev
   ```

4. Open the local URL printed in the terminal. Keep that terminal running while using the app.

## Deploy to Vercel

1. Push the project to a Git repository and import it into Vercel.
2. Add the required environment variables under **Project Settings → Environment Variables**. Add the Redis URL and token for room syncing, and `JAMENDO_CLIENT_ID` for Jamendo tracks.
3. Deploy or redeploy after setting the variables.

## API behavior

### `GET /api/search?q=...`
Returns a list of matching tracks.

### `GET /api/stream?id=...`
Converts a track ID into a playable audio URL.

### `GET /api/room?room=...&id=...`
Returns participant count, synchronized playback state, and recent room chat.

### `POST /api/room`
Accepts playback updates and chat messages/reactions. Chat messages can also be edited or deleted by their original sender.

## Notes

- Room names are normalized to a simple lowercase slug to keep URLs predictable.
- Playback sync is lightweight and updates periodically, so clients stay roughly synchronized.
- Chat is shared with everyone in the same room; the API only allows a sender to edit or delete their own text messages.
- Search results and playback availability depend on the Audius and Jamendo services.

## License

This project does not currently include a license file. If you plan to distribute or publish it, add a license that matches your intended usage.
