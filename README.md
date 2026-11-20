# Stripe Residency online

A shared Three.js island in Bali. Enter with the residency invitation and choose one of 21 makers, visit as a guest, or select **Join as yourself**. A new member can choose a name, describe what they are building, and customize their clay figure. Their profile stays in the residents list when they leave. The same browser lets them return, edit, or remove it.

Entering fills the screen with the island. The floating resident strip opens profiles while you play. Tap a destination, use the touch joystick, or move with WASD or the arrow keys. Drag to look around. Space or **Jump** makes your figure jump. Q or **Wave** waves to everyone nearby.

Open **Activities** or tap a place in the world to swim from the jetty, climb a coconut palm, ride the teal QuackParty motorbike, lounge on a sunbed, or work at a table. Walk into the sea at an open beach, steer freely in the water, and swim back onto the sand. Push up or down on a palm to change your grip. On the bike, forward accelerates, backward brakes and reverses, and left or right steers. **Park motorbike** leaves it where another player can pick it up.

## Run locally

Use Node 22.12 or later. Run `npm ci`, then `npm run dev`. The development command starts Vite and a local Workers runtime. Open the printed Vite URL in separate browser profiles to play as different people.

## The shared room

The Cloudflare Worker serves the website and upgrades `/live` to a WebSocket. All connections route to one named Durable Object. It owns character and seat claims, the persistent member directory, movement, waves and the shared beach ball. The room shares swimmer and rider positions, climbing progress, jump timing and the parked motorbike. Multiple players can swim together. Each climbable palm, work seat, the spare sunbed and the motorbike have one occupant at a time.

A browser tab receives a private reconnect ticket. A character stays reserved for two minutes after disconnect and becomes available immediately when released. Select Invite to copy the shared link. Everyone who has the invitation can join.

## Production

`npm run build` creates the Vercel website and a ZIP of all 21 GLB figures in `build/island`. The production project is `kyzobuilds/palm-hours`. Vercel serves the site and protects the residency invitation. Its middleware gives an invited browser a one-minute, origin-bound pass to open a WebSocket directly to the Cloudflare room. This also works in browsers that block third-party cookies.

Production uses the same `ISLAND_INVITE` and `ROOM_SIGNING_KEY` secrets on Vercel and Cloudflare. The invitation path is `/join/<ISLAND_INVITE>`. `wrangler.jsonc` configures the room. The private Sites entry opens the shared invitation through `COURTYARD_INVITATION_URL`.

`src/residents.js` contains the profile sources and keepsakes. The GPT ImageGen clay portraits live in `public/portraits`. Their original and revised prompts are in `art-direction.json`. Each playable resident has sculpted hair, bead eyes, a pressed-clay smile and a personal keepsake. The gallery, GLB download and island share the same figure. On the island, the eyes change expression when a resident waves or rests on a sunbed. The Stripe wordmark comes from the [Stripe newsroom](https://stripe.com/newsroom/information).
