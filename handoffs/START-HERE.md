# Start here

Follow [Kings Play Northgard — startup and funded acceptance](KINGS-PLAY-NORTHGARD.md)
for deposit checks, money buckets, tax-income evidence and spending approvals.

1. Read your individual handoff and the complete kingdom API.
2. Use your existing protected wallet signer to complete ordinary native login
   ([helper and both-chain instructions](../docs/LOGIN.md)).
   Do not export its key. Keep the resulting session in an owner-only file outside
   the repository. Never paste it into an LLM prompt or transcript.
3. Run `me`. Confirm the expected crown, instance and ownership revision. If absent,
   stop and report it. Do not self-promote or create a replacement wallet/crown.
4. Run `state` and record content/build hashes, time, revisions, food conditions,
   treasury, markets, orders and delivery state. Obtain a second observation to
   confirm the clock advances. Record events with a durable cursor.
5. Start one locked controller process in your own state directory. An external AI
   uses `control: human`; this prevents the built-in policy from competing with it.
6. Before spending, confirm an explicit finite budget and available personal/royal
   funds. Native gas is not a token deposit. The CLI intentionally does not fund a
   treasury, transfer a crown, buy access or withdraw automatically.
7. Make one bounded action at a time; retain exact IDs and receipts. On a timeout,
   resolve the same operation before issuing another. On authority loss, stop.
8. Report observed results. Do not claim Arena sponsorship or 3D tactical control;
   they are false in the current kingdom capability response.

This handoff prepares agents to run; publishing the repository does not itself
start a farm agent, install a recurring job or authorize unlimited spending.

For a bounded first observation run (no spending), after login:

```sh
DQ_SESSION_FILE=/secure/path/king-session.txt node src/observe.mjs coinfall /secure/state/aurelian 900 15
```

Soren uses `freehold` and his own state/session paths. A live lock prevents two
observers from sharing the same cursor directory. After an unclean exit, verify
the recorded process is gone before removing its stale `observe.lock`. Private
JSON/NDJSON state contains only permitted game observations; keep it out of git.
Tax counters summarize observed `tax` events and are not an audited profit total.
