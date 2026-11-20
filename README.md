# Stripe Residency online

A shared Three.js island in Bali. Enter with the residency invitation and choose one of 21 makers, visit as a guest, or select **Join as yourself**. A new member can choose a name, describe what they are building, and customize their clay figure. Their profile stays in the residents list when they leave. The same browser lets them return, edit, or remove it.

Tap to walk, drag to look, or use WASD. Space waves. Tap the beach ball to kick it. Open **Activities** to swim in the cove, stretch out on the spare sunbed, or work at a table with a 25-minute focus timer. The jetty float and sunbed are also interactive. Residents move around the island, read, photograph, type and stretch.

## Run locally

Use Node 22.12 or later. Run `npm ci`, then `npm run dev`. The development command starts Vite and a local Workers runtime. Open the printed Vite URL in separate browser profiles to play as different people.

## The shared room

The Cloudflare Worker serves the website and upgrades `/live` to a WebSocket. All connections route to one named Durable Object. It owns character and seat claims, the persistent member directory, movement, waves and the shared beach ball. Residents and swimmers follow the same choreography on every device using the room clock. Multiple players can swim together. Each work seat and the spare sunbed have one occupant.

A browser tab receives a private reconnect ticket. A character stays reserved for two minutes after disconnect and becomes available immediately when released. Select Invite to copy the shared link. Everyone who has the invitation can join.

## Production

`npm run build` creates the Vercel website and a ZIP of all 21 GLB figures in `build/island`. The production project is `kyzobuilds/palm-hours`. Vercel serves the site and protects the residency invitation. Its middleware gives an invited browser a one-minute, origin-bound pass to open a WebSocket directly to the Cloudflare room. This also works in browsers that block third-party cookies.

Production uses the same `ISLAND_INVITE` and `ROOM_SIGNING_KEY` secrets on Vercel and Cloudflare. The invitation path is `/join/<ISLAND_INVITE>`. `wrangler.jsonc` configures the room. The private Sites entry opens the shared invitation through `COURTYARD_INVITATION_URL`.

`src/residents.js` contains the profile sources and keepsakes. GPT ImageGen portraits live in `public/portraits`, with their original art direction in `art-direction.json`. The 3D figures use a portrait-specific head sculpt, hairstyle, wardrobe and keepsake. The same rig drives the gallery, downloadable GLB and animated island figure. The Stripe wordmark comes from the [Stripe newsroom](https://stripe.com/newsroom/information).
