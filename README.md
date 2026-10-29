# Zombie Apocalypse: Society Game

A classroom web app for the 904.04 Society Game. Students log a society, make Action 1 / Action 2 decisions, enter their real dice rolls, and move through 7 events. You control when each event opens with a passcode. Scoring runs on the server.

**Pages**
- `/` student app (setup, census, constitution, events)
- `/dashboard.html` leaderboard (hidden from students until you reveal scores; you can view it any time with the teacher password)
- `/admin.html` teacher controls (event passcodes, reveal scores, add/remove points, unlock a society, view every roll)

## Deploy (GitHub + Cloudflare Pages + D1)

1. **Put this folder in a GitHub repo.** Keep `functions/`, `public/`, `schema.sql` and `wrangler.toml` at the top level.
2. **Create the database** (needs Node installed, run once from this folder):
   ```
   npx wrangler login
   npx wrangler d1 create society-game
   ```
   Copy the `database_id` it prints into `wrangler.toml`, then:
   ```
   npx wrangler d1 execute society-game --remote --file=schema.sql
   ```
   (If you already ran an earlier version, run that same command again. It only adds the new `explore_used` table and keeps your data.)
3. **Create the Pages project:** Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick the repo.
   - Framework preset: None
   - Build command: *(leave empty)*
   - Build output directory: `public`
4. **Connect the database and set your password:** open the new project → Settings.
   - Bindings → Add → D1 database → variable name `DB` → choose `society-game`
   - Variables and secrets → Add secret `ADMIN_PASSWORD` (your teacher password)
   - Add both for **Production**, then redeploy (Deployments → Retry deployment).
5. Open `/admin.html`, sign in, and look at the 7 passcodes. They are random 4-digit codes; change them if you like.

## Running a game day

- Students: record keeper opens the site, **Start a society**, fills in census and constitution, and writes down the society code. Everyone else on the team can use **Return to your society** with the name and code.
- You: when the class is ready for Event N, share that event's passcode. Students who finished the previous event are waiting at a locked screen.
- Students submit Action 1, Action 2 and the Action 2 dice roll, the page moves to the Event activity, and they enter the event roll.
- Scores stay hidden from students. Open `/dashboard.html` and enter the teacher password to see standings. **Reveal scores to students** on the admin page when you want them to see results.
- Use **Add or remove points** for on-task bonuses and distraction penalties.
- **Start a new round** (bottom of the admin page) clears every society for the next class period. Each class period can also use its own society names.

## How scoring works

All of it lives in `functions/_lib/game.js`.

- Each roll is the die (1-6) plus a bonus of +1 per matching job, build, or supply, **up to +2**. Total 5+ is success, 3-4 partial, 1-2 fail.
- Action 2 builds count toward events later (a hospital helps with Sickness, defences and weapons help with Zombies, crops help with Food Shortage).
- Societies start with population 100, food 100, infrastructure 100. Events change those by the percentages on your slides.
- Score = population + 20% of food + 20% of infrastructure + action and event points + your adjustments.
- Gathering food or water, barter, amending the constitution, and choosing something that doesn't match the constitution without amending all have small point effects.
- **Exploration cards** (`EXPLORE` in `game.js`): good finds add points and supplies that help later rolls, bad ones subtract points. Students type the card's code under Go Exploring, see what happened, then continue to the event roll. Each code can be used once per society. The wise traveler (`hwta`) gives +1 to that round's event roll. The ransacked hospital (`xzms`) removes the backpack item the student picks. Point values are my choices; change them in `game.js`.

**Things I filled in because the slides didn't say:** partial-success results for Events 4 and 6 (10% population loss), all point values, and **Event 7 (Harsh Winter)**. Your slides end at Event 6. Edit or replace Event 7 in `game.js`.

## Test locally (optional)

```
cp .dev.vars.example .dev.vars
npx wrangler d1 execute society-game --local --file=schema.sql
npx wrangler pages dev public --d1=DB
```

## Notes

- Wrong passcode guesses lock that society out for 30 seconds after 5 tries.
- The leaderboard and teacher pages only need the password you set as `ADMIN_PASSWORD`; it is never stored in the repo.
