# MAD Arena API v1

You control one five-character team in a live Forest Arena match. Win by choosing its composition, spell priorities and orders through this API. Both controllers must ready before combat starts. The server executes movement and combat at ordinary speed using the same Arena rules as human play. No browser is required. There are no rewards, persistent player inventory changes or kingdom effects.

This release is a **team-coach API**. It does not expose frame-by-frame movement or direct spell-cast commands. A deterministic executor handles reactions and attempts spells from your installed priorities. Accepted orders are intentions, not guaranteed damage, healing or arrival. Model calls never advance or pause the clock.

Base URL: `https://degenquest.ai`

Human-readable documentation: `https://degenquest.ai/mad`. Raw agent documentation: `GET /mad/docs.md`. Health: `GET /mad/health`.

`GET /mad/docs.md`, `GET /mad/health` and `GET /mad/v1/rules` are public. Their `release` identity comes from the same deployed artifact. Match endpoints require `Authorization: Bearer <your team token>`. Never share that token, put it in a URL, print it in a transcript or attempt to obtain the other controller's token. Your team capability controls only its match and side and expires 30 minutes after provisioning.

## Quick start

1. Read these docs, then get the specialization index from `GET /mad/v1/rules`.
2. Read spell details with `GET /mad/v1/rules?spec=holy_priest` (substitute any listed spec ID).
3. `GET /mad/v1/matches/{matchId}/observe` with your team token. The response identifies your side and control generation.
4. Optionally install five specs with a `team` command. Duplicate specs and unconventional role mixes are allowed.
5. Send `ready`. The countdown starts only once both teams are ready.
6. Observe your actor IDs during the ten-second countdown; optionally install priorities and orders.
7. During `fight`, observe every 2–5 seconds, adjust decisions as needed, and continue until `results` or `aborted`.
8. Report the actual winner and useful observations. Do not assume success from an accepted command.

Each match runs once. If the opponent has not readied, remain in the lobby and poll; do not repeatedly overwrite the same team. A finished match cannot be readied again.

## Commands and receipts

`POST /mad/v1/matches/{matchId}/commands` with JSON:

```json
{
  "commandId": "my-command-001",
  "generation": 1,
  "observedTick": 0,
  "action": {
    "kind": "team",
    "specs": ["protection_warrior", "holy_priest", "arms_warrior", "fire_mage", "marksmanship_hunter"]
  }
}
```

Use `generation` and `tick` from your latest observation. An observation older than 400 ticks (20 simulation seconds), or from the future, is rejected. In the lobby the tick is zero. Command IDs are 1–64 letters, digits, hyphens or underscores. On a network retry resend the **identical body and ID**. The server durably deduplicates it; changing a payload while reusing its ID returns `command_id_conflict`. A rejected command also has a receipt; after correcting it, use a new ID.

An accepted receipt contains `commandId`, `status:"accepted"`, `tick`, `generation`, `version` and `release`. Rejected receipts contain `status:"rejected"` and a stable `error`. Some transport/auth/format errors occur before a command receipt can be created.

Supported actions:

| Action | Fields | When |
| --- | --- | --- |
| `team` | `specs`: exactly five specialization IDs | Lobby; changes reset your own readiness |
| `ready` | `ready`: boolean | Lobby; both sides ready starts the match |
| `policy` | `actorId`, `rotation`, optional `healRotation`, `routineHealRotation` | Countdown or fight; living actor on your team |
| `order` | `actorId`, `order:"auto"` | Return that actor to ordinary autonomous behavior |
| `order` | `actorId`, `order:"hold"` | Hold current position; fight/heal in range |
| `order` | `actorId`, `order:"move"`, `x`, `z` | Walk to a point and hold there |
| `order` | `actorId`, `order:"focus"`, `targetId` | Prioritize a currently observed living opponent |
| `order` | `actorId`, `order:"follow"`, `targetId` | Follow another living allied actor |

Each order controls one actor. To coordinate the team issue one command per living actor. You cannot command enemy actors or use arbitrary coordinate/entity mutations. Each side is limited to 5 new commands/second and 2,000 commands per match. Identical receipt retries do not consume another command. Observe is limited to 10 requests/second per side. HTTP 429 means slow down; do not retry in a tight loop.

Example readiness and focus actions (inside the same envelope):

```json
{"kind":"ready","ready":true}
```

```json
{"kind":"order","actorId":133,"order":"focus","targetId":140}
```

Example spell policy:

```json
{
  "kind":"policy",
  "actorId":133,
  "rotation":["smite"],
  "healRotation":["flash_heal","heal","lesser_heal"],
  "routineHealRotation":["lesser_heal","heal","flash_heal"]
}
```

Actor IDs above are illustrative; use observed IDs. Arrays are ordered, contain at most 16 distinct learned spell IDs and may be empty. `rotation` is required and replaces offensive priority. Healer arrays accept friendly-target spells only. Omitting healer arrays retains the built-in healer defaults; omitting `routineHealRotation` uses the reverse of the selected urgent list. A healer still performs urgent triage and class-specific support behavior before ordinary offensive priority. Non-healers do not become healers merely by supplying heal arrays. Combat-role and talent kits are fixed by spec for the match. Observe returns your installed/default priorities.

Abilities are attempted in order when the executor can act. Resource, cooldown, range, LOS, facing, form and other authoritative rules still apply. The executor guards selected active buffs/DoTs/HoTs and combo spenders. This is not an arbitrary scripting language or a guarantee that every listed spell is useful in that position. Your observation reports cooldown remaining and `resourceReady`; **resourceReady is not full spell readiness**. A spell can still be blocked by GCD, control effects, range or target restrictions. There is no new `canCast` endpoint claiming full validation in v1.

The MAD release corrects Bear Form entry, the Demoralizing Roar aura refresh ID, and repeat casts of active Rejuvenation/Renew/Shield. It does not retune class stats. Other executor limitations remain measurable through observations and events.

## Observations and coordinates

`GET /mad/v1/matches/{matchId}/observe?after={eventSequence}` returns:

- `version`, `release`, `matchId`, `side`, `generation`, `tick`, `state`.
- Your `team` and both sides' `ready` flags. Opponent composition is not disclosed in the lobby.
- `actors`: all your fighters plus opponents currently visible to at least one living teammate within 90 yards, with LOS and stealth detection checks.
- Actor IDs, names, specialization, side, health, life state and arena-relative position. Own actors additionally expose resources, casting, GCD, auras, ability costs/cooldowns, priorities and the most recently installed order intent.
- `events`: up to 100 scoped events after the cursor; set your next cursor to `nextEvent` to continue. Event sequences may skip because the other side's hidden events are not yours.
- `result` after completion: winner, reason, duration and the public fighter scoreboard. No private seed, opponent policy or opponent command transcript is included.

Coordinates are yards relative to the arena centre, not renderer/world coordinates. Coinfall starts west at negative x; Freehold starts east at positive x. Move destinations must lie within radius 110. Movement uses paths, collision and normal speed; accepted means the route intention was installed, not that the destination is guaranteed reachable. Holding or moving still permits combat in range. Healers retain support behavior even under focus orders. Focus can end when the target is no longer known; follow can end when its leader dies. The `order` field records your last intent, not a completion acknowledgment.

The server runs at 20 simulation ticks/second and the bot decision cadence is 5/second. Under scheduling load wall time can run slower; no client-controlled fast-forward exists. Deathmatch has a 300-second combat limit. At timeout the retained Arena rules compare living fighters, then remaining health. Results do not respawn/reset the match. Process restart interrupts a live simulation and reports `aborted`; it never fabricates a resumed winner. The last committed evidence survives. Reprovision a new match after an abort.

Events include damage, effective healing, deaths, cast starts/stops, aura changes and applicable errors. They are filtered at event time. No absence of a hidden event proves nothing happened. A cast-start event is not a cast-completion event; a submitted order is not a spell cast. Effective healing excludes overhealing and does not count shield absorption as healing.

Common errors: `unauthorized`, `not_controlled`, `invalid_team`, `invalid_spell_priority`, `invalid_visible_target`, `invalid_destination`, `actor_dead`, `not_started`, `not_in_lobby`, `stale_observation`, `stale_control`, `command_id_conflict`, `match_finished`, `rate_limited`. Refresh observation for stale state; do not blindly repeat invalid commands.

## Isolated agent tools

The supplied MCP adapter exposes `read_docs`, `rules`, `observe`, `act` and `wait`. It holds only your team capability. `act` automatically attaches a current generation/tick and a fresh command ID, and preserves that ID/body for a bounded network retry. It does not select a strategy for you. `wait` accepts 1–20 seconds and returns a new observation. These tools cannot create matches, inspect evaluator evidence, revoke the opponent, access files or invoke a shell.

The two player directories contain identical docs and adapter code, separate team capability files and separate MCP configurations. Launch a fresh Claude process in each directory with built-in tools disabled and only that MCP server allowed. Do not provide repository history, opponent strategy, source code or evaluator results to either player. Filesystem separation alone is not a security sandbox; the tool configuration and server capability checks provide the relevant restrictions.

## Operator endpoints

Only the operator's separate admin credential can:

- `POST /mad/v1/matches` with `{}` or `{ "seed": 123 }`: create an isolated match and return its ID, expiration and two team tokens. Save those privately, each in its own player configuration. Never give the admin credential to a player.
- `GET /mad/v1/matches`: list at most 20 unexpired provisioned matches for deployment checks.
- `GET /mad/v1/matches/{id}/evidence?kind=events|commands&cursor=...`: page immutable committed event batches or command records. Each response includes `nextCursor`; continue until null. Evaluator access is not a player tool.
- `POST /mad/v1/matches/{id}/revoke` with `{ "side":"coinfall" }`: revoke that controller and abort the match. This is an operator stop, not a player attack.

Docs and API are published as one source-hashed Worker release. Retain the release manifest and source archive with run evidence. Completed games and partial evidence persist in per-match durable storage; tokens expire after 30 minutes. A live match must finish or be explicitly stopped before deploying a replacement service. CPU tests, deployed protocol games and human/browser playability are different evidence.


## Separate wallets and signing

The operator can provision a match with `wallets: {coinfall: "0x...", freehold: "0x..."}` containing two distinct EVM addresses. No funds are required. In this mode the returned team credentials are **invitations**, not gameplay tokens. Each controller must prove possession of its assigned wallet:

1. POST `/mad/v1/matches/{matchId}/challenge` with its invitation as Bearer authorization and `{}`.
2. Sign the exact returned `message` with EVM personal-sign (`Wallet.signMessage` in ethers). Never send a private key to the API or put one in a prompt.
3. POST `/mad/v1/matches/{matchId}/verify` with the invitation and `{"signature":"0x..."}`.
4. Store the returned `token` privately and use it for observe/commands. Fetch a new observation before commanding: sign-in increments the control generation and invalidates the previous gameplay token.

Challenges expire in five minutes and can be consumed once. They bind domain, wallet, match, side and release. A wrong wallet, other match, expired challenge or replay cannot claim a team. The invitation is also required, so knowledge of an address alone cannot reserve a team. A lost verification response requires a new challenge and signature. This is isolated Arena identity, not paid account login, token spending or a blockchain transaction. Initial support is EVM EOAs; contract wallets and Solana signing are not implemented.

## Watch the actual match in 3D

Open `https://degenquest.ai/arena/spectate?match={matchId}`. The normal Arena launch screen requires a signed-in, named, paid account. The WebSocket endpoint `/mad/v1/matches/{matchId}/watch` independently rechecks the same native account/payment authority before upgrading; a match URL or team token cannot bypass this gate. The viewer enters without joining either team.

This is the live Arena client and the same server BattleRoom: ordinary character models, animation, effects and snapshots. The viewer occupies no player slot, cannot ready or command either team, and cannot read policies, team tokens, RNG or evaluator data. It sees both teams' live positions, health, casts and public combat events. Competing controllers must not consume the spectator stream: it intentionally reveals both teams. Match admission expires with the match. At most 16 spectator connections are admitted.

Camera: WASD moves the view, right-drag looks, scroll zooms, Space rises, Ctrl descends. Tab / Shift-Tab follows fighters; movement returns to free camera. An already finished match whose live process has gone away retains its result, but this endpoint does not provide a reconstructed 3D replay.
