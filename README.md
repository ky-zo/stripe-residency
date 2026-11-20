# Stripe Residency online

A shared Three.js island in Bali. The resident list contains the 21 invited makers. Choose a resident to play, enter anonymously, or select **Join as yourself** to choose a guest name and customize a clay figure for this visit. Visiting guests appear as characters in the shared scene. The lobby, HUD and character picker show the invited residents. Leaving the island or refreshing the page ends the visit.

Entering fills the screen with the island. The floating resident strip opens profiles while you play. Tap a destination, use the touch joystick, or move with WASD or the arrow keys. Drag to look around. PowPow2 trots by the south beach and Poopi runs a longer loop across the island. Space or **Jump** makes your figure jump. Q or **Wave** waves to everyone nearby.

Open **Activities** or tap a place in the world to swim from the cove, climb a coconut palm, ride the teal QuackParty motorbike, lounge on a sunbed, or work at a table. **Step inside the warung** walks you up the timber step on its east side to the galley behind the counter. The roof, awning and sign fade while you are inside. On foot the camera leads a little in the direction you walk and slowly eases round behind you. Walking toward the camera leaves the view where it is. Walk down the beach and wade into the shallows. At knee depth your figure starts swimming. Swim back toward the sand to stand up again. Push up or down on a palm to change your grip. On the bike, forward accelerates, backward brakes and reverses, and left or right steers. **Park motorbike** leaves it for the next rider. Drive into the surf and you start swimming where you splashed in. The shared scooter returns to its island parking spot.

The eastern beach has a bouldering problem and a padel court. Use up and down or tap the boulder to move between holds. On the court, move into position and press **Swing** or Space. Practice against the far wall alone or rally across the net with a friend. The court tracks your rally and the room’s best.

Pick **Go surfing** to ride from the board rack. Steer with the joystick, keyboard, or a tap on the water. **Pump** or Space catches a swell. The outrigger canoe seats two. The helm paddles and steers, and the passenger takes over when the skipper hops off. Swimmers can reboard alongside the hull. The canoe returns to its mooring after the crew has left the area. The open ocean extends 100 world units from the island center in every direction. **Back to shore** swims you home.

## Run locally

Use Node 22.12 or later. Run `npm ci`, then `npm run dev`. The development command starts Vite and a local Workers runtime. Open the printed Vite URL in separate browser profiles to play as different people.

## The shared room

The Cloudflare Worker serves the website and upgrades `/live` to a WebSocket. All connections route to one named Durable Object. It keeps players, guest details and character claims in memory for active connections. The shared beach ball and parked motorbike use the toys table. The canoe crew, padel rally and court record last for the active room. The room shares swimmer and rider positions, climbing progress and jump timing. Multiple players can swim together. Each climbable palm, work seat, the spare sunbed and the motorbike have one occupant at a time.

Disconnecting releases the player's character and seat. An open tab can reintroduce its guest during a network interruption using its current page memory. Select Invite to copy the island link. Anyone with the link can join.

## Production

`npm run build` creates the Vercel website and a ZIP of all 21 GLB figures in `build/island`. The production project is `kyzobuilds/palm-hours`. Vercel serves the public site at [stripe.house](https://stripe.house). Its middleware gives each browser a one-minute, origin-bound pass to open a WebSocket directly to the Cloudflare room. Old `/join/…` invitation links redirect to the front page. This also works in browsers that block third-party cookies.

Production uses the same `ISLAND_INVITE` and `ROOM_SIGNING_KEY` secrets on Vercel and Cloudflare. Vercel uses `ISLAND_INVITE` only to read the member directory from the room. `wrangler.jsonc` configures the room. The private Sites entry opens the shared invitation through `COURTYARD_INVITATION_URL`.

`src/residents.js` contains the profile sources and keepsakes. The GPT ImageGen clay portraits live in `public/portraits`. Their original and revised prompts are in `art-direction.json`. Each playable resident has sculpted hair, bead eyes, a pressed-clay smile and a personal keepsake. The gallery, GLB download and island share the same figure. On the island, the eyes change expression when a resident waves or rests on a sunbed. The Stripe wordmark comes from the [Stripe newsroom](https://stripe.com/newsroom/information).
