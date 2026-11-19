# Museum Detectives

### 🔗 Play it: [british-museum-detectives.pages.dev](https://british-museum-detectives.pages.dev)

A Language in Action field-trip game for the British Museum. Student teams solve 14 object mysteries, take photo evidence, and race for a place on a live leaderboard.

## How it works

- **Teams** pick a team name (and optionally their centre), then start a timed hunt.
- **14 missions**: each one has the object's room, an optional spotting hint, a name check, and a photo upload. The floor guide works offline.
- **Case file**: at the end, teams save their completed trail as a PDF. Answers are kept on the phone, but photos can be lost if the page is closed, so they should export before leaving.
- **Live rankings**: finished hunts are ranked by score, then fastest time, and the board refreshes every 15 seconds. You can filter by centre.
- **Staff area** (🔒 Staff button): sign in with the staff password to see every team, filter by centre and status, and delete teams from the leaderboard.

Photos never leave the student's phone. Only team name, centre, score and times are sent to the server.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The whole game: missions, floor guide, case file and layout |
| `brand.css` | Language in Action styles |
| `live.js` | Timer, live start/finish, leaderboard |
| `staff.js` | Staff area |
| `firebase.js` | Firebase sign-in and Firestore (`runs` collection) |
| `firebase-config.js` | Firebase project settings and the staff-password hash |
| `sw.js` | Service worker that lets the game open offline |
| `manifest.webmanifest`, `icon.svg` | "Add to home screen" support |
| `assets/` | Logo and Gabarito font |

It's plain HTML, CSS and JavaScript, so there's no build step.

## Backend

Firebase project `lia-british-museum-detec-da557` provides:
- **Authentication**: students sign in anonymously; staff use an email/password account behind the scenes.
- **Firestore**: one document per team hunt in `runs`.

The values in `firebase-config.js` are public by design. The Firestore security rules (set in the Firebase console) are what protect the data.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy

The site is hosted on Cloudflare Pages (project `british-museum-detectives`) using direct upload. It isn't connected to this repo, so a push doesn't deploy anything. To publish, run this from the repo folder:

```bash
npx wrangler pages deploy . --project-name british-museum-detectives --branch main
```

When you change any cached file, bump `CACHE` in `sw.js` (for example `museum-detectives-adventure-v14`) so phones pick up the new version.
