# Adventure Land - The Code MMORPG (MongoDB Edition)

https://adventure.land

A full Node.js + MongoDB port of [Adventure Land](https://github.com/kaansoral/adventureland), originally built on Python 2 / Google App Engine / Datastore. This version replaces all of that with Express, Socket.IO, and MongoDB.

**Please consider supporting Adventure Land on Patreon: https://www.patreon.com/AdventureLand**

## Repositories

This project is split across three repositories:

| Repository | Description |
|---|---|
| [adventureland_mongodb](https://github.com/kaansoral/adventureland_mongodb) | Main game — Express backend, game server, client assets |
| [common_engine](https://github.com/kaansoral/common_engine) | Shared engine — Express init, MongoDB transactions, request handling, admin tools |
| [adventureland_secretsandconfig](https://github.com/kaansoral/adventureland_secretsandconfig) | Config template — keys, options, server definitions (all values randomized/empty) |

## Quick Start

### 1. Clone all three repositories

```sh
# Main game
git clone https://github.com/kaansoral/adventureland_mongodb.git adventureland

# Shared engine (symlinked as adventureland/common)
git clone https://github.com/kaansoral/common_engine.git common

# Config template (symlinked as adventureland/secretsandconfig)
git clone https://github.com/kaansoral/adventureland_secretsandconfig.git secretsandconfig
```

### 2. Create symlinks

```sh
cd adventureland
ln -s ../common common
ln -s ../secretsandconfig secretsandconfig
```

### 3. Install dependencies

```sh
# Main backend
npm install

# Game server
cd node
npm install
cd ..
```

### 4. Set up MongoDB

Install MongoDB locally or use a hosted instance. The default config in `secretsandconfig/keys.js` points to `127.0.0.1:27017` with no auth — this works out of the box with a default local MongoDB install.

If your MongoDB requires authentication or TLS, edit `secretsandconfig/keys.js`:

```js
mongodb_ip: "your-server-ip",
mongodb_port: "27017",
mongodb_user: "your-user",
mongodb_password: "your-password",
mongodb_name: "adventureland",
mongodb_tls: true,                                          // set to true if using TLS
mongodb_ca_file: path.resolve(__dirname, "your-ca.crt"),    // place your CA cert in secretsandconfig/
```

### 5. Configure keys

Open `secretsandconfig/keys.js`. The keys auto-generate random values on each startup, which is fine for local development. For production, set fixed values:

- **`ACCESS_MASTER`** — Admin access key (used for server eval/render, admin tools)
- **`SERVER_MASTER`** — Server-to-server authentication
- **`BOT_MASTER`** — Bot authentication key
- **Stripe keys** — Only needed if you want payments
- **Steam/Discord/Apple keys** — Only needed for those platform integrations
- **Amazon SES** — Only needed for sending emails (verification, password reset)

### 6. Add a hosts entry (optional)

```sh
# Add to /etc/hosts (or C:\Windows\System32\drivers\etc\hosts on Windows)
127.0.0.1       adventure.test
```

Then update `secretsandconfig/options.js`:
```js
base_url: "http://adventure.test",
```

Or just use `http://localhost` — the default config works without any hosts entry.

### 7. Seed the map data

Before starting either server, follow [Seeding Game Data](#seeding-game-data) to load the bundled maps into a fresh local MongoDB database.

### 8. Start the backend

```sh
node main.js
```

The backend starts on port **8090** (configurable in `secretsandconfig/options.js`). Visit http://localhost:8090

### 9. Start the game server

```sh
cd node
node server.js local
```

The argument is a key from `servers` in `secretsandconfig/options.js`. The default `local` server runs on port **7192**.

### Discord chat (optional)

The game server reuses `discord_token` from `secretsandconfig/keys.js` for event announcements and public chat. Public chat defaults to Adventure Land's `#game_chat` channel. To use another channel, set `discord_chat_channel` in `secretsandconfig/options.js` to its string ID and give the bot permission to view it and send messages. Use the same channel ID on every game server to combine their public chat. An empty string disables chat forwarding; event and join announcements keep their existing channels.

Messages include the realm and character name. Public chat is batched over ten seconds; party chat and private messages are excluded. The relay sends nothing back into the game and is disabled in development, test, and hardcore modes. It uses bounded memory, five-second request timeouts, and at most three attempts per batch. Messages expire after two minutes, so an outage or overload can drop chat. No extra Discord package or Gateway connection is needed.

## Seeding Game Data

Run [scripts/seed_mongodb.js](scripts/seed_mongodb.js) once before starting the backend or game server. It includes the 49 map geometry records needed by `design/maps.js` and inserts them into MongoDB's `map` collection. No SQLite dump, Python setup, or production access is needed.

Items, monsters, NPCs, and other game definitions already live in `design/`. Accounts, characters, and server records are created as you use the game; the seed contains no player data.

Set `mongodb_name` in `secretsandconfig/keys.js` to a fresh database and point `mongodb_uri` at your local MongoDB instance. Keep both servers stopped while seeding. From the repository root, run:

```sh
# Check the local connection and confirm the database has no collections (read-only)
node scripts/seed_mongodb.js --dry-run

# Insert the maps; replace adventureland with your exact mongodb_name
node scripts/seed_mongodb.js --confirm adventureland
```

Running without arguments only prints help and does not connect to MongoDB. The script accepts a single local address (`127.0.0.1`, `localhost`, or `::1`), refuses remote, SRV, and proxy connections, and is disabled when `NODE_ENV=production`. Use an actual local MongoDB instance, never a tunnel to an existing database. For a hosted installation, seed locally first and transfer that fresh database using your own deployment process.

The database must have **no collections**, even empty ones. The script requires the exact database name before inserting and refuses repeat runs. It never overwrites or deletes records. If insertion is interrupted, it may leave partial map data and will refuse another attempt; inspect the target and use a new empty database for a fresh seed.

After seeding, start both servers using the Quick Start steps and sign up through the web UI.

## Project Structure

```
adventureland/
  main.js                  # Express backend (port 8090)
  api.js                   # API endpoints (REF pattern)
  adventure_functions.js   # Game functions (auth, characters, servers, etc.)
  models.js                # MongoDB model definitions
  crons.js                 # Scheduled tasks
  filters.js               # Nunjucks template filters
  node/
    server.js              # Game server (Socket.IO)
    server_functions.js    # Game logic
    precompute_bfs.js      # BFS pathfinding precomputation
    precomputed_map_data.js # Generated BFS data
  design/                  # Game data (items, monsters, maps, skills, etc.)
  htmls/                   # Nunjucks templates
  js/                      # Client-side JavaScript
  css/                     # Stylesheets
  images/                  # Game art and tilesets
  sounds/                  # Sound effects and music
  scripts/
    seed_mongodb.js       # Bundled map geometry and guarded local database seeding
  common -> ../common      # Symlink to common_engine
  secretsandconfig -> ...  # Symlink to your config
```

## Making Yourself Admin

With `Local: true` and `unsecure_admin: true` in options.js, visit:

```
http://localhost:8090/admin/make/user/admin
```

While logged in. This sets `user.admin = true` on your account, giving access to `/admin/executor` and `/admin/renderer`.

With `Local: true` and `unsecure_admin: true`, all users are treated as admin automatically. This only works from localhost connections.

## Contributing

PRs are welcome! Please keep them **small and focused** — one fix or one feature per PR. Large PRs that touch many unrelated things are hard to review and likely to be rejected. If you're planning something big, open an issue or discuss it on Discord first.

## Discussion

Use the **#development** channel on Discord for questions and collaboration: https://discord.gg/hz25Kz9FsH

## Code Formatting

This project uses [Prettier](https://prettier.io/) for the game server (`node/` folder). If you use VSCode, install the recommended extensions — formatting happens automatically on save.

## License

[AdventureLandOnlyUse](LICENSE) — free for commercial use with attribution. See the license file for full terms.
