# King agents: deposits, treasury allocation and Arena funding

Owner handoff, 2026-10-26. Give this document to Aurelian and Soren. Each agent
uses its own wallet, crown, signer, session and private working directory.

## The immediate answer

Both kings already completed a real one-token deposit test. Do not repeat it.
Read your own current `/api/wallet` balance: existing personal game credit can
fund an approved activity without another blockchain deposit. Additional deposits
are needed only if a new approved budget exceeds your available personal credit.

The Arena money game is not enabled in production. Depositing more tokens alone
does not enable it. Both Arena purses are unfunded at the October 26 audit, and
no live king-to-king awards or player token prizes have settled. Match wins, XP
and leaderboards are separate from token settlement.

This handoff authorizes reconciliation and preparation. It does not set a new
transfer amount, recurring allowance or permission to spend the remaining wallet
tokens. Return a concrete bounded proposal before executing a new financial run.

## Read first

- [Protected wallet login](../docs/LOGIN.md)
- [Native account and token API](../docs/api/native.md)
- [Kingdom API](../docs/api/kingdom.md)
- [Completed bounded-run follow-up](BOUNDED-RUN-FOLLOWUP.md)
- [Bounded controller and recovery](../docs/BOUNDED-PROCUREMENT.md)
- Live docs: <https://degenquest.ai/docs> and <https://degenquest.ai/docs/kingdom.md>

The production origin is `https://degenquest.ai`. Current live capabilities and
fresh observations take precedence over old examples and balance tables.

## Identity and authentication

| Agent | Crown | Own token | Chain |
| --- | --- | --- | --- |
| Aurelian | Coinfall | GOLD | Base, chain ID 8453 |
| Soren | Freehold | DQS | Solana mainnet |

Use the existing protected wallet signer and ordinary native login. Do not make
a replacement wallet, export keys, request an operator/service secret, claim a
crown or connect to the other agent's files. An account-held off-chain crown is
kingdom authority; a loaded character and special king API key are unnecessary.
Paid admission still applies if the agent also enters Arena as a player or
spectator. Merely operating the kingdom API is a separate activity.

Keep the opaque 64-hex session in an owner-only file outside the repository.
Do not include cookies, signatures, signed transaction bytes or private financial
observations in prompts, source control or public reports.

## Three distinct money buckets

| Bucket | Funding mechanism | What it pays for |
| --- | --- | --- |
| Personal game credit | Finalized GOLD/DQS deposit through `/tokens` or wallet deposit APIs | Credit owned by the authenticated account |
| Persistent kingdom treasury | Live `POST /api/kingdom/treasury/fund`, with integer `copper` | Merchant liquidity, procurement, food support and the persistent economy |
| Arena purse | Separate Arena funding integration; not publicly enabled yet | Accepted player prizes and the king's round loss reserve |

Sending personal credit into the **kingdom** treasury does not fund Arena prizes.
Kingdom taxes do not automatically sweep into the Arena purse. A chain gas
deposit is not GOLD/DQS credit. The game peg is 10,000 copper per token, not a
USD price peg. GOLD has 18 decimals; DQS has 8.

A personal-credit shortfall does not automatically require new chain funds:
the owner may separately approve returning unreserved kingdom treasury credit
through `/api/kingdom/treasury/withdraw`. That is an internal transfer back to
personal credit, not an external token withdrawal. Do not cancel existing contracts
or move that money to Arena without an explicit allocation.

The service implements an Arena funding contract at
`POST /api/wallet/arena/fund` using atomic token units. That route is currently
absent from the public production gateway allowlist. Do not call it, guess a
replacement, bypass the gateway or fund a different bucket as a workaround.
Wait for a published public integration and an approved exact budget.

## First assignment: observe and report, without sending funds

1. Authenticate with your existing wallet through the protected signer.
2. Read `GET /api/wallet` and record your own available balances, readiness and
   linked wallet for each currency. Read `GET /api/kingdom/me`; verify your expected
   crown instance and ownership revision.
3. Read `GET /api/kingdom/state?crown=coinfall` or `freehold`. Record realm,
   content/build hashes, time, authority revision, external control mode,
   treasury and existing orders. Do not infer private opponent balances.
4. Reconcile prior operation IDs through your private receipt endpoint before
   proposing any new transfer. In particular, the completed run
   `northgard-soren-caravan1-20261025` must not be repeated or renewed. Its stopped
   controller checkpoint is historical; accepted contracts completed afterward.
5. Report whether available personal credit covers the proposed budget. If it
   does, propose an internal allocation, not an additional chain deposit.
6. If production still reports `arenaSponsorship:false`, or the funding API is
   unavailable, report `ARENA_INTEGRATION_REQUIRED`. Do not install a spending
   loop or attempt to enable server configuration yourself.

## Arena integration required from the game-server implementer

The king agents operate ordinary player APIs. These are server implementation
gates, not permissions for an agent to write the database or configure services:

- Bind Arena funding authority to the current account-held crown. The retained
  financial service's configured principals are not sufficient crown-transfer
  integration. Losing a crown must stop future royal actions without cancelling
  existing accepted contracts.
- Publish authenticated Arena funding, balance, offer, acceptance and receipt
  routes. Keep internal register/start/settle credentials server-side.
- Connect the trusted live lobby roster, round start and result outbox to the
  financial ledger; a player or king cannot submit its own winning result.
- Lock exact per-human token amounts, valuation reference and expiry. The $5
  target needs an accepted valuation for each token. An unavailable price is not
  permission to invent one or treat copper as dollars. A separately approved
  fixed-token smoke test must not be described as a verified $5 round.
- Reserve both prize and loss pools and obtain each human's prize acceptance
  before a funded round starts. Bots and spectators do not enlarge the budget.
- Verify one capped live financial round, ordinary player balances, original-token
  king awards, draw/abort refunds and duplicate-result protection.

Until these gates pass, Arena funding and recurring sponsorship stay off. The
isolated settlement suite already exercises both winners, fair rounding,
eligibility, consent, refunds, stale valuations and repeated/concurrent results.
Those tests are not live payouts.

## Ordinary Arena start rule

Each side needs at least one connected, seated human/controller, and every seated
player must ready. Ordinary player agents count as player seats; spectators and
NPCs do not. Losing a side's last player during countdown returns to the lobby
with readiness cleared and no XP or win. Mid-fight disconnects retain NPC backfill.
Dedicated automated simulations remain separate from funded human rounds.

## Accepted round economics, once the integration is live

For a side with `n` human players and a locked own-token amount `a` per human:

`required reservation = n × a for player prizes + n × a for the loss reserve`

Each king therefore needs **2 × n × a**, plus any separately approved operating
reserve. Use exact atomic units. Keep GOLD and DQS distinct; never combine their
nominal totals into a USD valuation.

- Eligible winning humans share their own king's accepted prize pool.
- Losing humans receive no prize; their unused prize pool returns to their king's
  Arena purse. The winning king recovers its own loss reserve.
- The losing king's loss reserve credits the winning king's **personal game
  balance in the original losing token**. Coinfall winning can award its king
  DQS; Freehold winning can award its king GOLD.
- Draws and aborted rounds return the reservations. No swap, bridge, native
  ETH/SOL payout or per-round blockchain settlement is part of this model.

Opponent-token credit does not automatically enter a persistent kingdom treasury.
An optional external withdrawal requires a fresh, exact wallet signature and a
verified destination wallet for that currency. A login session or JWT alone
cannot authorize it. Withdrawals and manual swaps are separate owner decisions.

## If another deposit is actually approved

Use `/tokens`, or prepare an unsigned transaction with
`POST /api/wallet/deposit-transaction`. Check the exact chain, token, recipient,
amount and gas/rent ceiling before protected signing. Persist the intent and hash,
submit/reconcile the receipt and wait for finalized credit in `/api/wallet`.
Do not send another deposit after a timeout without reconciling the first one.
Existing deposits, treasury allocations and old test IDs are not reusable budgets.

## Return this readiness report

```text
Agent / crown:
Authenticated crown instance and authority revision:
Realm / content hash / build hash:
Own personal available GOLD / DQS (private):
Own kingdom treasury GOLD / DQS (private):
Existing operations and receipts reconciled:
Arena funding API/capability available:
Locked token amount / valuation / expiry:
Human count and consent plan:
Proposed total allocation / spending ceiling / duration:
Additional chain deposit needed: yes/no, exact amount if yes:
Blocker or next permitted action:
```

Send this privately to the owner. Each agent reports only its own account and
actor-scoped knowledge. Keep separate controller locks and state directories;
never renew an expired mandate, recrown on reconnect or run a second writer to
work around an unresolved operation.
