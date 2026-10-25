# Play Together

Play Together is a small web app for syncing music or YouTube playback between two people in the same room. One user creates or joins a room and shares the link. The app keeps room state synchronized so both sides stay in step while listening.

### Live Link - [Play Together](https://playtogetherr.vercel.app)

## Features

- Shared room-based listening experience
- Create a room with a chosen name or join with a room ID or invite link
- Search and play free audio tracks from Audius and Jamendo
- Synchronized play, pause, shuffle, and loop controls for shared audio
- Synchronized YouTube playback
- In-room chat available while listening to music or watching video, with member count, replies, quick emoji reactions, and inline edit/delete controls for your own messages
- Real-time room and playback sync backed by Redis
- Invite link generation for quick sharing
- Responsive light/dark interface with custom room artwork
- Account signup and login with unique usernames and email addresses, plus a persistent profile
- Lightweight frontend with serverless API routes

## Project structure

- `public/index.html` – frontend UI and client-side sync logic
- `api/search.js` – searches tracks from free music APIs
- `api/stream.js` – resolves a track ID to a streaming URL
- `api/room.js` – stores playback state, room presence, chat, and reactions in Redis
- `api/auth.js` – registers accounts, verifies password hashes, and manages profile sessions in Redis
- `api/_audius.js` – Audius API helper
- `api/_jamendo.js` – Jamendo API helper

## Tech stack

- Lightweight HTML/CSS/JavaScript frontend
- Serverless API routes in the `api/` folder
- Redis REST API for room state, chat, accounts, and sessions (Upstash-compatible)
- Audius and Jamendo for audio search and streaming
- YouTube IFrame Player API for video playback
- 
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

Accounts use the configured Redis store. Usernames and email addresses are unique (case-insensitive); passwords are stored as PBKDF2 hashes, and signed-in sessions use an HTTP-only cookie with a seven-day lifetime.

## API behavior

### `GET /api/search?q=...`
Returns a list of matching tracks.

### `GET /api/stream?id=...`
Converts a track ID into a playable audio URL.

### `GET /api/room?room=...&id=...`
Returns participant count, synchronized playback state, and recent room chat.

### `POST /api/room`
Accepts playback updates, chat messages/reactions, and participant departures. Chat messages can include a `replyToId` referencing a recent room message, and can also be edited or deleted by their original sender. When the last participant leaves, the room's chat, playback state, and presence data are deleted.

### `GET /api/auth`
Returns the signed-in user's public profile, or `null` when no valid session is present.

### `POST /api/auth`
Accepts `signup`, `login`, and `logout` actions. Signup reserves the username and email atomically so duplicate accounts cannot claim either identifier.

## Notes

- Room names are normalized to a simple lowercase slug to keep URLs predictable.
- Playback sync is lightweight and updates periodically, so clients stay roughly synchronized.
- Chat is shared with everyone in the same room; the API only allows a sender to edit or delete their own text messages.
- The room chat works in both Audio and Video modes. A reply includes a short, server-validated quote of the original message.
- Closing a room tab removes that participant; when the room becomes empty, its saved chat and playback state are cleared. Stale participants are pruned and empty-room data is cleared the next time someone joins.
- Search results and playback availability depend on the Audius and Jamendo services.
- The frontend stays as plain HTML/CSS/JavaScript because this app is small and static UI code is not the reported bottleneck. React or Tailwind could help with a larger component system or a consistent design workflow, but adopting them alone would not make the app faster and would add build/runtime dependencies.
