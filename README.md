# DegenQuest Kingdom Agent

The epic is **Kings Play Northgard**. Read the [funded startup handoff](handoffs/KINGS-PLAY-NORTHGARD.md).
For the next funding step, use the [Arena funding handoff](handoffs/ARENA-FUNDING-HANDOFF.md).

Operate a kingdom as an ordinary DegenQuest player account holding an off-chain
crown. No king API key, NFT or loaded character is required. This repository is a
client and handoff kit for Aurelian (Coinfall) and Soren (Freehold).

The one-token deposit test and bounded live treasury/tax cycle passed, including
restart and exact-retry checks. [Live evidence](docs/evidence/live-treasury-cycle-2026-10-25.json)
records the completed budget. New funding or recurring strategy needs a new owner budget.

Start with [the handoff](handoffs/START-HERE.md), then the
[kingdom API](docs/api/kingdom.md) and [wallet login guide](docs/api/native.md). The farm [protected signer helper](docs/LOGIN.md) supports both kings.
Live documentation: https://degenquest.ai/docs and
https://degenquest.ai/docs/kingdom.md.

```sh
npm test
DQ_SESSION_FILE=/secure/path/native-session.txt node src/cli.mjs me
DQ_SESSION_FILE=/secure/path/native-session.txt node src/cli.mjs state coinfall
DQ_SESSION_FILE=/secure/path/native-session.txt node src/cli.mjs events coinfall 0
DQ_SESSION_FILE=/secure/path/native-session.txt node src/cli.mjs command /secure/path/action.json
```

Node 22+; no dependencies. The session file must be owner-only and contain only
the opaque 64-hex native login session. Sign in through the existing protected
wallet signer; this client does not read private keys, buy account access or
withdraw tokens. It prints game observations and receipts, never credentials.
Commands require a complete explicit JSON action with current revisions and ID.
No unattended spending loop is installed by this kit.

For an explicitly approved finite sequence of orders, the
[bounded procurement runner](docs/BOUNDED-PROCUREMENT.md) persists exact requests,
caps reservations and retries, waits for observed fills and cleans up uncommitted
remainders at its deadline. It does not replenish a treasury, renew its budget or
claim that a local fill proves a caravan journey.

## What exists

Persistent strategic Blockreach economy; authenticated actor-scoped observations;
account-held crown authority; conserved personal/treasury ledger transfers;
funded market orders and food support; durable command receipts and events.

The historical “Kings play Northgard” epic supplies the design intent: rulers
manage production, food, finite money and trade while humans inhabit the world.
Its old fleet-secret promotion, minted income and regicide shortcuts are not
production capabilities. See [rules and evidence](docs/RULES.md).

Live 3D caravan/combat integration and Arena sponsorship are explicitly disabled
in the kingdom capability response. Arena and MAD have separate APIs and evidence
boundaries. See [API index](docs/api/README.md). A working strategy API does not
mean all MMO interactions are implemented.

Use separate process/state/session directories for each king. Never commit keys,
sessions, wallet signatures, private endpoint credentials or funding instructions
that exceed the operator's budget. Crown transfers and external withdrawals
require an explicit owner instruction. The API rechecks crown ownership for every
royal mutation; a reconnect never restores a lost crown.
