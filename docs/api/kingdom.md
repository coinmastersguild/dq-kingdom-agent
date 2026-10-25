# Kingdom agent API v1

The production origin is `https://degenquest.ai`. All kingdom state and commands
require the same wallet login as other DegenQuest accounts. A king has no special
API key. An account-held off-chain crown item grants authority without loading a
character. This model was explicitly selected on 2026-10-25.

## Login and discovery

Follow `/docs` (machine-readable `/docs.md`) for wallet challenge, signing and
session verification. Use the opaque native session with
`Authorization: Bearer <64-hex-session>` or the website's HttpOnly session cookie.
A JWT, wallet address, character name or caller-supplied account header is not
identity. Keep sessions and signing keys outside repositories and recordings.

1. `GET /api/kingdom/me` returns your crown items, realm clock, content/build hashes
   and capabilities. No crown is a successful response with `crowns: []`.
2. `GET /api/kingdom/state?crown=coinfall` returns your actor-scoped `view` plus
   `revision` and `authorityRevision`. Use `freehold` for that crown.
3. Issue a supported command, retain its exact request and receipt, then observe.
   On `409 STATE_CHANGED`, the submitted stale command was rejected; refresh state
   and retry deliberately. Exact replays of accepted IDs still return their receipt. Do not blindly retry with a new ID.
4. Poll `GET /api/kingdom/events?crown=coinfall&after=0`. Persist `next` as a decimal
   cursor. Drain pages while `more` is true. Events include sequence, index and
   an event with simulation-second `at`, type, subject, detail and audience.
5. On `401`, reauthenticate normally. On `403 CROWN_REQUIRED`, stop royal actions.
   On `409 CROWN_CHANGED`, discard queued actions and rediscover your crown.

`GET /api/kingdom/receipt?id=<returned-operation-id>` retrieves only receipts
created by your account. A timeout is an unknown outcome: retry the identical
request/ID while still authorized, or retrieve its receipt. Receipt IDs are
`realm-command-<realm>-<client-id>` for commands and
`realm-<realm>-<client-id>` for treasury funding/withdrawal. Crown transfers use
`crown-transfer-<realm>-<client-id>`. IDs must be 8–96 ASCII letters, numbers or
hyphens. Reusing an ID with different contents fails.

All POST bodies use `Content-Type: application/json`, maximum 16 KiB. Same-origin
browser requests only; headless clients can send ordinary HTTPS requests.
Responses are not cached. Errors return `{error, code?}`. Unknown routes return
404 at the gateway; malformed/invalid domain actions generally return 409;
unsupported command types return 400. Backend unavailability returns 503. Apply
bounded backoff; do not interpret a 503 as a rejected financial operation.

## Observations and clock

`me`: `{realm, geography, contentHash, buildHash, time, revision, clock, crowns,
capabilities}`. `clock` contains `stepSeconds`, `speed` and `backlogSeconds`.
`crowns` contains `{realm,crown,instance,item,revision}` for your owned items only.
The item revision is `authorityRevision` in state/command requests, distinct from
the world's changing `revision`. `state` adds `view`, an actor-scoped
`dq-kingdom-view-v1` observation: known settlements, markets, treasury, orders,
commerce, sites, routes and environment. `view.marketPolicies` exposes only markets this crown governs, with settlement,
accepts, taxBps, bid, baseBid, spread, blockedFactions and merchantFunds. Preserve
`baseBid` when reapplying configured pricing; `bid` may reflect current quotes.
Hidden rival state and the random seed
are not supplied. Do not infer ownership from names or wallet chain.

The server advances one persistent clock at real-time speed, in five-second
steps, including while no player is connected. Bounded catch-up resumes after
service downtime; `backlogSeconds` reports remaining lag. Clients cannot advance,
rewind or reset it. Geographic routes come from received Blockreach content.
Economic rates remain provisional. Record both hashes with experiments.

## Commands

`POST /api/kingdom/commands`:

```json
{
  "id": "king-market-policy-0001",
  "crown": "coinfall",
  "authorityRevision": 1,
  "expectedRevision": 123,
  "intent": {"type":"control", "mode":"human"}
}
```

Replace revisions with a fresh observation. The server supplies the actor;
caller-supplied actor fields cannot impersonate a king. The `human` control mode
means an external account controller (including an AI agent), so built-in royal
policy does not compete with it. `ai` delegates future choices to the server's
validated banking policy while the crown remains held. Accepted contracts continue
in either mode. Crown transfer switches to external control and revokes the old
account immediately.

| Intent | Fields after `type` | Effect |
|---|---|---|
| `control` | `mode: "human" or "ai"` | Choose external control or built-in banking policy |
| `market-fund` | `settlement, currency, copper` | Transfer actual crown treasury money to an accepting merchant |
| `market-policy` | `settlement, accepts, taxBps, bid, spread` | Set policy only in an authorized market; `bid` maps every resource to an integer price |
| `buy-order` | `settlement, resource, currency, quantity, unitPrice` | Reserve the complete order cost in the treasury |
| `cancel-buy-order` | `order` | Cancel by observed order ID, subject to existing commitments |
| `market-access` | `settlement, faction, allowed` | Change access where authorized; does not annex a settlement |
| `food-support` | `settlement, currency, copper, maxUnitPrice` | Reserve funded food support; food must actually exist |
| `cancel-food-support` | `support` | Cancel by observed support ID |

Currencies are exactly `GOLD` and `DQS`. Money quantities are positive integer
copper units, not USD, floating-point tokens or gas units. Market tax basis points
range 0–2000; spread 0–100; each bid price 1–100000. Royal funding and orders must
fit available funds. Consult live observations for resource/settlement/order IDs.
No public royal-deposit/mint, claim/promote, reset, clock, conquest or internal
result-submission endpoint exists. Independent markets keep their own acceptance,
access and sovereignty. AI kings cannot seize crowns or annex kingdoms.

## Personal balances and crown treasury

`/api/wallet` and `/tokens` manage personal token balances. Confirm deposits there
before funding a kingdom. Chain gas is not game credit. Wallet proof and finalized
chain receipts govern deposits; the realm cannot mint an unbacked credit.

`POST /api/kingdom/treasury/fund` transfers personal custody credit into the named
crown treasury. `POST /api/kingdom/treasury/withdraw` transfers available treasury
credit back to the current king's personal custody account. Both require current
crown ownership and a verified linked wallet for the selected currency:

```json
{"id":"king-fund-000001","crown":"coinfall","authorityRevision":1,
 "currency":"GOLD","copper":1000}
```

Neither operation sends an on-chain transaction. At the configured peg,
1 copper is 0.0001 token: GOLD uses 10^14 atomic units per copper (18 decimals),
DQS uses 10^4 (8 decimals). This is not a USD price peg. The king can hold either
currency if its account has the corresponding wallet linked and verified.
Reserved funds cannot be withdrawn. Personal and kingdom balances remain separate.

**Every external token withdrawal still requires a fresh wallet signature** using
`/api/wallet/withdrawal-challenge` and `/api/wallet/withdrawals`; a login cookie,
opaque session or JWT alone cannot authorize it. The kingdom treasury endpoint is
an internal ledger transfer, not a substitute for this withdrawal proof.

## Crown items

`kings_crown_coinfall` and `kings_crown_freehold` are durable account-held off-chain
items, one instance per crown in this realm. The initial assignment is audited
operator setup, never a startup entitlement or self-coronation API. Logout and
restart preserve ownership. A normal player can receive an item and then rule.

`POST /api/kingdom/crown/transfer` accepts:

```json
{"id":"crown-transfer-0001","crown":"coinfall","authorityRevision":1,
 "recipient":"RECIPIENT_PRINCIPAL_FROM_THEIR_TOKEN_ACCOUNT"}
```

The recipient must have signed in to token accounts and cannot already hold the
other crown in this realm. Transfer uses ordinary account authorization; it
moves a game item, not external funds. It atomically changes item authority and
world revision. Existing funded contracts continue; the former holder's personal
funds remain theirs. A retry of the identical transfer returns its recorded
receipt. Agents must never initiate transfer without their owner's instruction.

The retained MMO helmet-equipment authority is a separate legacy path. This API
uses the approved account-held model; it does not claim that equipping or dropping
a legacy character helmet transfers the production account-held item.

## Scope and agent handoff

Capabilities declare strategic economy support, `tacticalPlayable:false`, and
`arenaSponsorship:false`. Live 3D caravan admission/combat and automatic Arena purse
funding are not enabled by this API. The isolated archived review is not this
custodied realm; mock balances are never migrated into redeemable credits.

Run one external controller per account with a process lock. Start by observing,
then use an explicit spending budget and bounded decisions. Record redacted
observations, build/content identities, action IDs, receipts, event cursors,
failures, treasury totals, population/food stress and order delivery outcomes.
Do not put session cookies, signatures, keys or wallet-challenge messages in logs.
A second controller is not granted a server lease: optimistic world revisions
reject conflicting commands, but clients must enforce one policy runner.
