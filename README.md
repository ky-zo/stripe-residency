# Palm Hours

A shared Three.js island for 18 makers. Enter through the residency invitation and choose a character. Tap to walk, drag to look, or use WASD. Space waves. Tap the beach ball to walk over and kick it. A stool or cushion starts a local 25-minute focus timer, and everyone on the island can see who is sitting there.

## Run locally

Use Node 22.12 or later. Run `npm ci`, then `npm run dev`. The development command starts Vite and a local Workers runtime. Open the printed Vite URL in separate browser profiles to play as different people.

## The shared room

The Cloudflare Worker serves the website and upgrades `/live` to a WebSocket. All connections route to one named Durable Object. It owns character and seat claims, movement broadcasts, waves and the beach ball. Unclaimed characters follow the same choreography on every device using the room clock.

A browser tab receives a private reconnect ticket. A character stays reserved for two minutes after disconnect and becomes available immediately when released. Select Invite to copy the shared link. Everyone who has the invitation can join.

## Production

`npm run build` creates the website and a ZIP of all 18 GLB figures in `build/island`. The Cloudflare deployment uses `wrangler.jsonc` and the `ISLAND_INVITE` Worker secret. The invitation path is `/join/<ISLAND_INVITE>`. The private Sites entry uses `COURTYARD_INVITATION_URL` to open the same island.

`src/residents.js` contains the profile sources and keepsakes. The GPT ImageGen portraits live in `public/portraits`, with their generation prompts in `art-direction.json`.
