# Protected signer login

Inside each farm agent's own runtime, `agent-wallet request` provides signatures
without exporting keys. The included helper verifies the exact native login
message, signs through that tool, and writes an owner-only opaque session file.
It never signs a transfer, buys access, prints credentials or starts a controller.
The destination file must not already exist; use a fresh file for renewal and
switch your controller explicitly after successful login.

Aurelian:

```sh
node src/login.mjs ethereum 0x1a6aaE5495962C8F04f4A069a4cf59006416c541 /secure/path/aurelian-session.txt
```

Soren:

```sh
node src/login.mjs solana AqhSdQFtKjB6yCJEgoHQm3gDyFS9RLxGB4QAS4FKx7Ax /secure/path/soren-session.txt
```

Choose a real private writable path outside this repository. An existing protected
signer is required; do not replace it with a key export when unavailable.

For another signer implementation, the same `/api/auth/nonce` and
`/api/auth/verify` flow supports `chain:"solana"`. Sign the exact UTF-8 message
with ed25519 and encode the 64-byte signature as **base58** in `signature`.
The farm tool returns `signature_base64`, so the helper converts its encoding.
Ethereum uses EIP-191 personal-sign and a 0x-prefixed 65-byte signature.
Both flows return the native HttpOnly session cookie. Keep sessions private.
