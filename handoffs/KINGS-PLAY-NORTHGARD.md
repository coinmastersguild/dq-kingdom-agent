# Kings Play Northgard — startup and funded acceptance

Owner handoff, 2026-10-25. The epic is **Kings Play Northgard** (also referred to as
“northgaurd”). Aurelian and Soren compete as economic rulers in persistent
Blockreach. They should develop production, trade, food security and treasury
revenue while humans inhabit the world. Funding a wallet or a simulator pass does
not establish a working funded kingdom.

## Verified state before the approved deposit

Both actual king accounts authenticated through their protected wallet signers,
received their account-held crowns and submitted scoped market-policy commands.
No loaded character or special king credential is required. The production realm
is `blockreach-live`; the account-held crown is the source of authority for this
API. The legacy MMO helmet path is separate.

The 2026-10-25 unsigned deposit preflight used the real public API and real wallet
addresses. It confirmed:

| King | Wallet tokens | Native gas | Personal game balance | Deposit preparation |
|---|---:|---:|---:|---|
| Aurelian / Coinfall | 100 GOLD | 0.002134004 ETH | 0 GOLD | Exact 1-GOLD transfer; Base execution estimate succeeded |
| Soren / Freehold | 100 DQS | 0.249308988 SOL | 0 DQS | Exact 1-DQS transfer; unsigned Solana simulation succeeded |

GOLD contract: `0x2218b3908B2f33B75241397a26fB27383cd8B35c`, Base chain 8453.
DQS mint: `2kma6VS71GtVthg7eg7nm1r3HCDLEeXWPtVWbsH5dyZg`, Solana mainnet.
The DQS source account was
`4JykXngkZM9NcDLRkLck8BZ3Rj9MXpyJwQPvSoQHPq8d`.

Expected custody destinations:

- GOLD custody owner: `0xF8671E136DdCd58b41954B02e4D72dd6E470E980`.
- DQS custody owner: `8wtDFZyKZZfNNpSfWV8SqyT1szdxC4E3yBAoa6rmP7gY`;
  DQS custody ATA: `asC3GvRMLTMTw1Lcw55NPyoVM8REdeHZkRj52rhCTHf`.

The preflight sent **no transaction**. The separately approved live test is tracked
by its own transaction receipts; simulation evidence below is not that result. Login messages were signed, but deposit
transactions were neither signed nor broadcast. It does not prove finalized
credit. A signed transaction alone is also not evidence of a deposit.
Evidence: `.local/kingdom-custody/deposit-preflight.json` (redacted), produced by
`.local/kingdom-custody/deposit-preflight.py` on the custody host.

## Funded live result — passed

Both approved deposits finalized and credited exactly once. Each king now has
**1 token in the personal game account and 99 tokens in its original wallet**.
Both persistent crown treasuries remain zero; no treasury funding or spending was
authorized. A new agent must reconcile these completed operations, not repeat them.

| King | Finalized transaction | Total native cost |
|---|---|---:|
| Aurelian | [Base receipt](https://basescan.org/tx/0xb3898547b557862283db3899f8f9f2c1cf0a38f4f92948f618e3c2efea00f8c5) | 0.000000308579411624 ETH |
| Soren | [Solana receipt](https://solscan.io/tx/64h7FLuhdWpcjzLGtG8HWfsFeTt2SHttiziLyzvgDM3ASuYTFsRmHYXyYBbUR1sQFR77NdoYaAoJZbZEqsMfwBba) | 0.00149344 SOL, including account rent |

Repeated public deposit submissions returned identical credited receipts and did
not change balances. Each deposit has exactly one backed journal entry. Custody
reserves cover both liabilities at or beyond their proof heights. After service
restart, credits, receipts and crowns persisted and realm time continued; no
transaction was created during recovery. Aurelian's first submit lost its response
after broadcast; recovery found the already submitted transaction by its stable
signer operation rather than sending another transfer.

The public evidence is `docs/evidence/live-deposits-2026-10-25.json` in the agent
repository. Operator journal/reserve evidence is
`.local/kingdom-custody/king-deposit-recovery.json`.

## Three money buckets and how kingdoms earn

1. **King personal custody balance**: credited by finalized token deposits;
   controlled by the authenticated account. External withdrawals require a fresh
   exact wallet signature. Sessions and JWTs cannot authorize an external exit.
2. **Persistent crown treasury**: funded explicitly from personal custody credit
   through `/api/kingdom/treasury/fund`. It owns economic policy, funded procurement,
   merchant liquidity, food support and tax receipts. The next crown owner controls
   this treasury; the prior king keeps their personal funds.
3. **Arena sponsorship treasury**: separate reservations/purses, currently disabled
   in production. It is not automatically funded by a kingdom treasury deposit.

The kingdom already collects taxes from actual household trades, funded resource
sales, supported meals and caravan deliveries in markets it governs. Taxes move
existing deposited money to the crown treasury; they never create currency.
Merchant proceeds, household income, taxes and goods consumption are separate.
Subsidizing your own merchants and collecting part back as tax is recirculation,
not net profit. Track deposits, transfers and gross taxes separately.

Under the last accepted Arena rules, winning eligible humans split their own
king's prize, and the losing reserve in its original token goes to the winning
king's **personal** account. The Arena bridge remains disabled. Automatically
routing those awards into the persistent crown treasury would be a further
explicit product/integration change, not behavior agents should assume today.

## Funding authorization

On-chain deposits and treasury spending have different approvals. The owner explicitly approved one live test of **1 GOLD + 1 DQS only** on
2026-10-25. Execution uses stable protected-signer operation IDs
`dq-northgard-deposit-aurelian-1-20261025` and
`dq-northgard-deposit-soren-1-20261025`. This is a single execution authorization;
a new agent must reconcile these operations and must not repeat the deposits.
Approved maximum native costs: 0.00005 ETH for the Base deposit including fees,
and 0.002 SOL for the Solana deposit including account rent. Recheck the live
quote and abort above either cap. The unsigned DQS preflight estimated 5,000
lamports fee plus 1,488,440 lamports rent; Base estimated 51,749 gas, with L1 data
fees additional to its execution fee estimate. These are observations, not fixed
future prices.

No approval for the other 99 tokens, treasury funding, recurring spending, crown
transfer, external withdrawal, swapping or Arena sponsorship follows from the
1-token test. Keep token quantities distinct from USD valuation.

## Startup sequence

### 1. Observe without spending

Clone `https://github.com/coinmastersguild/dq-kingdom-agent`. Read `AGENTS.md`,
`docs/LOGIN.md`, `docs/api/kingdom.md` and the king's individual handoff.
Use separate sessions, process locks, working/state directories and signers.
The signer command must run inside the matching king runtime; never export keys.

Authenticate normally and confirm `/api/kingdom/me` owns the expected crown.
Record realm, content/build hashes, world revision, crown authority revision,
clock/backlog, treasury, food stress, population and public markets. On
`CROWN_REQUIRED`, stop royal commands. On `CROWN_CHANGED`, discard queued actions
and rediscover authority. Reconnect never restores or recreates a crown.

A bounded observation runner is provided as `src/observe.mjs`. It issues only
GETs and does not purchase, deposit, fund, trade, withdraw or transfer items.

### 2. One authorized deposit per king

1. Recheck the exact approved token amount, chain identity, token, source wallet,
   custody owner/ATA, instruction list and native fee/rent ceiling.
2. Request `/api/wallet/deposit-transaction` with `{currency,amount:"1"}`.
   Verify the EVM transfer calldata/type-2 envelope or both Solana ATA/transfer
   instructions. Simulate against the current chain. Solana blockhashes expire;
   refresh only before signing and retain the approved semantic transfer.
3. Record a stable signer operation ID **before** signing/submitting. Use the
   protected wallet's transaction tool. Base has no raw EVM transaction-signing
   method in the current farm signer; use its validated, bounded
   `transaction_simulate` / `transaction_submit` interface. Do not misuse
   `evm_personal_sign` as transaction signing. Solana supports
   `solana_sign_transaction`; submit only the verified signed bytes.
4. Record the exact transaction hash immediately. Post the receipt through
   `/api/wallet/deposits` if the signer broadcasts directly, or use
   `/api/wallet/deposit-broadcast` for a signed raw transaction. Automatic finalized
   discovery also recovers missing callbacks for a verified bound wallet.
5. Poll chain finality and `/api/wallet` until exactly 1 token is credited once.
   One token equals 10,000 copper at the configured token peg. Repeat submission
   of the same hash must preserve one credit. On a timeout, reconcile the same
   signer operation and transaction first; never send another token just because
   a response was lost. Preserve pending hashes across process restart.
6. Reconcile custody reserves against the complete liability journal. Record
   deposited atomic units, actual native fee/rent, final block identity, game
   balance delta and duplicate/restart results.

Pass: two finalized transfers, exactly one personal credit for each, no extra
transfer, conserved liabilities and enough native gas retained. Failures retain
receipts and stop further deposits. Do not declare this gate passed from simulation.

### 3. Allocate an approved royal operating budget

After deposit verification, obtain a specific allocation per crown/currency plus
maximum total expenditure and run duration. `POST /api/kingdom/treasury/fund` is an
internal ledger transfer. Read current `authorityRevision`; retain its unique ID
and receipt. A 1-token test deposit does not authorize funding all 100 tokens.
Use external control mode `human` for an AI account controller so built-in policy
does not compete. An agent choosing delegation uses `ai` explicitly.

### 4. Prove treasury income with a funded cycle

Choose an owned capital's actual observed resources, stock, bids and capacity.
Preserve the approved tax policy, fund a bounded merchant or procurement order,
and observe actual sales/purchases. Show a positive tax event reaching that crown
treasury, while accounting for the outgoing liquidity/order cost, goods and
household proceeds. Cancel only the uncommitted remainder and verify its refund.

Pass: durable command receipt, actual trade/delivery, positive treasury tax
receipt, correct net cash movement, no negative account and no minted balance.
World activity may fill an order in parts; aggregate observed events/receipts.
A rejected command or accepted-but-unfilled order is not a completed trade.

The isolated received-Blockreach rehearsal used **0.1 token per crown**
(1,000 copper), with a **0.05-token first merchant disbursement** (500 copper).
After five simulation seconds, each capital bought four harvested food units for
420 copper: households received 412 and the crown received 8 tax. Remaining
treasury 508 + merchant 80 + household 412 equals the original 1,000 copper.
That is measured tax recirculation, with net treasury cash down 492 copper,
not new profit. Duplicate actions, order reserve/cancel, two database reopens and
backing checks passed. This is a small rehearsed acceptance allocation, not a
sustainable 24/7 operating budget; it still requires separate live approval.

Reproduce with `bun scripts/check-kingdom-tax-cycle.ts` in the game repository.
It uses isolated PostgreSQL and fixture chain receipts, makes no mainnet calls,
and leaves the live and archived realms untouched.

### 5. Bounded autonomous run

Use the approved budget and a single controller per account. Start with one
bounded decision at a time, durable IDs and actor-scoped observations. Run with
no humans connected, then stop/restart the controller and verify clock/state,
contracts, cursors and balances persist. Test ownership loss in an isolated
fixture; never move the real crown as an unapproved production test.

### 6. Arena funds integration

Keep sponsorship disabled until current crown authority replaces configured king
roles, rosters/valuations are locked, human prize consent is recorded, actual
reserves are funded and the trusted result outbox settles once. Decide the
intended beneficiary of king awards explicitly before changing it. No per-round
on-chain sale, bridge or settlement is part of the accepted design.

## Required report and stop conditions

Report per currency: chain deposits, personal balance, crown treasury, merchant
and household money, order/food-support escrow, refunds, gross taxes, subsidies,
net treasury movement, deliveries, living population, unmet meals, rejected or
unresolved commands, authority revision, clock backlog and actual fees. Include
content/build identity and exact action/transaction/receipt IDs. Do not sum GOLD
and DQS nominal balances or label token holdings as USD without a current approved
valuation source.

Stop spending on lost crown, unverified transaction contents, exceeded budget,
halted custody, insufficient funds, unknown prior transaction outcome or ledger
mismatch. Keep keys, session cookies, login/withdrawal signatures and raw signer
responses out of public reports. Separate isolated CPU/PG, unsigned mainnet
simulation, funded live protocol, browser/MMO and performance evidence.
