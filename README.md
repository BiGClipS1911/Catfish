# CATFISH - Evolutionary Breeding, Simulation & Real-time Multiplayer

An evolutionary virtual pet simulation game. Feed, oxygenate, control water temperature, breed 5 generations of Catfish and exotic hybrid species, clean fish poop (💩), and compete on global multiplayer leaderboards!

## Features

- **UI & Gameplay Guidance**: Interactive "How to Play & Objectives" tutorial, real-time dynamic mission guidance banner on top of the tank, and evolution stage progress bars.
- **Genetic Cross-Breeding**: Face photo feature extraction and merging into offspring egg sacs, with inheritable genetic traits (Golden Scales, Voracious, Thermal Tolerant, etc.).
- **Real-Time Multiplayer Lobby**: Switch between Solo Laboratory Tank and Global Online Lobby to see other aquarists' fish swimming together in real time and send global chat messages.
- **Global Leaderboards**: REST API + WebSocket leaderboard tracking top aquarists by Research Points, Dynasty Generation, and Elder Fish Released.
- **Railway Deployment Ready**: Pre-configured with `server.js`, `package.json`, `Procfile`, and `railway.json` for 1-click cloud deployment.

---

## 🚀 How to Deploy to Railway (Get Online with Multiplayer)

### Option 1: Deploy via GitHub & Railway Dashboard (Recommended)

1. **Push to GitHub**:
   Push this project folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "CATFISH Multiplayer & Railway release"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/catfish.git
   git push -u origin main
   ```

2. **Deploy on Railway**:
   - Go to [Railway.app](https://railway.app) and sign in.
   - Click **"New Project"** -> **"Deploy from GitHub repo"**.
   - Select your `catfish` repository.
   - Railway will automatically detect `package.json` & `railway.json`, run `npm install`, and start `node server.js`.
   - Click **"Generate Domain"** under Networking settings in Railway to get your live public URL (e.g., `https://catfish-production.up.railway.app`).

### Option 2: Deploy via Railway CLI

If you have the Railway CLI installed:
```bash
railway login
railway init
railway up
railway domain
```

---

## 🕹️ How to Deploy HTML5 Web Build to itch.io

1. **Zip the Project Files**:
   Select `index.html`, `style.css`, `server.js`, `package.json`, `Procfile`, `railway.json`, `leaderboard.json`, `Images/`, and `js/` directory, then compress them into a single `.zip` file (e.g. `catfish-itch.zip`).
2. **Upload to itch.io**:
   - Go to [itch.io/game/new](https://itch.io/game/new).
   - Under **Kind of project**, choose **HTML** (You have a zip file of static files that will be played in the browser).
   - Click **Upload files** and select `catfish-itch.zip`. Check the box **"This file will be played in the browser"**.
   - Embed options: Set Viewport dimensions to **840px wide by 660px high** (or check "Mobile friendly" / "Enable fullscreen button").
3. **Always Connected Railway Server Integration**:
   - The game will automatically detect it is running inside an itch.io iframe and connect to your Railway server domain (`https://catfish-production.up.railway.app`).
   - All real-time multiplayer fish replication, live chat, and global leaderboards work out of the box!

---

## 🎮 How to Play

1. **Vital Care**: Keep O2 > 60% with the Aerator Pump, keep temperature between 18–24°C with the Water Heater, and scrub fish poop (💩) using the Squeegee.
2. **Feeding**: Drop food pellets to prevent fish starvation.
3. **Breeding**: Drop Love Aphrodisiac and click **Initiate Mating Ritual** when 2 adult fish are present.
4. **Evolution & Release**: Nurture fish through 5 stages (Egg Sac -> Larva Fry -> Tadpole -> Adult Catfish -> Elder Frog-Fish). Release Elder Frog-Fish for +1000 PTS to advance your Dynasty generation!
5. **Leaderboards**: Compete globally and climb to #1!
