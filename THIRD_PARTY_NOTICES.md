# Protocol compatibility

The canonical JSON and negotiation description encoding in `src/lib/quote.ts` implement the BNB Agent SDK's documented interoperable wire format. Reference implementation: https://github.com/bnb-chain/bnbagent-sdk (MIT). The session, escrow and passkey implementation uses the installed `@altananetwork/sdk` package, whose MIT license is included in its npm distribution. PancakeSwap and TermiX references identify their external data/protocol sources; no affiliation or endorsement is implied.

All other dependency licenses are shipped in their respective npm packages and pinned by package-lock.json.
