# Bounded procurement run

`src/procure.mjs` runs an explicit finite sequence of royal buy orders using the
ordinary authenticated kingdom API. Merchants independently decide whether actual
stock, workers, provisions, capacity, access and funded prices permit a caravan.
There is no direct dispatch command, fixture access or privileged simulation.

This program cannot deposit, fund a treasury, withdraw, transfer a crown, change
prices/access, delegate to the built-in AI or install a recurring service. It can
only place the manifest's exact buy orders and cancel their uncommitted remainders.
Its budget is a gross reservation ceiling; refunds never permit replacement orders
or renew the budget. A manifest is a client operating limit, not a new server lease.
The account still needs current crown authority for every command.

## Prepare the manifest

Use fresh `/api/kingdom/me` and `/api/kingdom/state` observations. A real operator
must approve the currency, total copper, exact orders and duration. Keep the
manifest and runtime state outside the repository. The shape below is illustrative
and does not authorize spending or supply valid current pins/deadlines:

```json
{
  "schema": "dq-bounded-procurement-v1",
  "id": "owner-approved-unique-run-id",
  "realm": "blockreach-live",
  "crown": "coinfall",
  "currency": "GOLD",
  "contentHash": "REPLACE_WITH_OBSERVED_64_HEX_HASH",
  "buildHash": "REPLACE_WITH_OBSERVED_64_HEX_HASH",
  "authorityRevision": 1,
  "realmFrom": 50000,
  "realmUntil": 53600,
  "wallUntil": "2026-10-25T20:00:00.000Z",
  "maxWallSeconds": 3600,
  "maxCopper": 500,
  "maxCommands": 6,
  "maxPostAttempts": 16,
  "orders": [
    {"settlement":"SOURCE_MARKET", "resource":"food", "quantity":1, "unitPrice":1},
    {"settlement":"SOURCE_MARKET", "resource":"wood", "quantity":1, "unitPrice":1},
    {"settlement":"DESTINATION_MARKET", "resource":"wood", "quantity":1, "unitPrice":1}
  ]
}
```

Use actual observed resource/market IDs and rehearse the funded route economics.
Money is integer copper, not USD: 10,000 copper equals one token at the game peg.
The complete sum of `quantity * unitPrice` must fit `maxCopper`; all phases are
included even if some are likely to refund. The tool accepts one to four phases,
at most 16 logical commands, at most 64 POST attempts, and at most one realm day
and one wall day. These software ceilings do not enlarge the owner's mandate.
Reserve at least two command slots and POST attempts per phase, including its
possible cleanup. Purchase retries cannot consume the final cleanup attempt.

Each phase waits until every earlier order is fully filled with zero remaining
and zero reserved quantity. This supports food procurement, stock procurement,
then a destination order that may attract a merchant shipment. A local household
fill satisfies procurement; it does not prove that goods traveled between cities.
Prices and finite stock can change while earlier phases fill.

External control must already be `human`. The runner does not take control for
you. It refuses changed realm/content/build identity, clock regression, a clock
speed other than 1×, a changed crown revision or a lost crown. Reconnect is never
permission to reacquire control or renew an expired mandate.

## Execute and stop

Inside the appropriate king runtime, after ordinary protected-signer login:

```sh
DQ_SESSION_FILE=/secure/aurelian/session.txt \
  node src/procure.mjs --execute /secure/aurelian/approved-mandate.json \
  /secure/aurelian/procurement-state 5
```

Soren uses his own session, private directory, manifest and Freehold crown.
The program runs in the foreground. It requires a private state directory outside
this checkout, a directory lock, and a per-user/per-realm/per-crown writer lock in
the operating system's temporary directory. A second writer fails instead of
competing. The server does not provide an exclusive controller lease; run one
writer per account and do not use a separate CLI to bypass its operating budget.

`SIGINT`/`SIGTERM`, the absolute realm deadline, absolute wall deadline or elapsed
wall-duration limit stop new purchases. The runner cancels its own uncommitted
remainders. Reserved cargo/payment contracts continue according to the realm;
they are not recalled or refunded. A short disconnected-cleanup grace is bounded
at five wall minutes, then the process exits with durable state for reconciliation.
Do not repeat a run under a new ID or refill a spent mandate automatically.

## Recovery and evidence

The checkpoint is `procurement.json`, with owner-only permissions. Updates write
and fsync a temporary file, rename it, then fsync its directory. The manifest hash,
original wall start, policy version, pins, exact pending requests, attempts,
receipts, initial/decision actor-scoped observations and event cursor survive
restart. Record the agent repository commit with release evidence. Never edit these files to erase a
pending outcome or replenish a budget.

The event cursor bootstraps with `after=tail`, then resumes its durable decimal
cursor. The service must support that authenticated API extension. Only relevant
own-order receipt events are retained; active caravan details are not required.

A lost POST response is unknown. Before issuing another command, the runner reads
the private receipt ID and otherwise replays the identical persisted request.
Only `409 STATE_CHANGED` proves rejection and permits refreshing the request's
world revision. New retries retain the same logical ID. An unknown purchase at
expiry is not replayed: the runner halts and preserves it for receipt reconciliation.
It never obtains a fresh ID to work around a rejected or uncertain operation.

Restart with the same manifest/session/state directory after verifying the old
process is gone. A clean exit removes its locks. An unclean exit deliberately
leaves locks; inspect their PID on the same host and verify no writer exists before
removing those stale lock files. Do not remove locks based only on their age.
Renewing a login session does not reset the manifest or change crown authority.

Console summaries contain mandate/action IDs, phases, observed treasury/order
totals and stop reasons. Session files, keys, signatures and challenge messages are
never printed. Runtime observations remain private and must not be committed.

`complete` means all requested procurement quantities were observed filled.
`stopped` means the mandate ended and uncommitted remainders were cleaned up;
outstanding reserved contracts are reported separately. `halted` requires deliberate
reconciliation. None proves full 3D caravan admission, browser hauling, escorts or
attribution of a generic journey to a particular royal order. Live journey acceptance
must separately verify an authoritative delivery/return and conserved ledger.

Run `npm test` for budget, phase ordering, receipt recovery, revision rejection,
expiry cleanup, reserved-contract preservation, authority/pin loss, retry bounds
and tampered-manifest recovery tests. These are client contract tests with a
fake authenticated service, not production gameplay or performance evidence.
