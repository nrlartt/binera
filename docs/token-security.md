# Token security research (GoPlus)

Binera's token scan is a first-party integration with the public GoPlus token-security API. No MCP server, API key or private key is required.

- Endpoint: `GET /api/research/security?token=0x…`
- Provider: `https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses=…`
- Caching: 60 seconds per token; response text is capped at 18,000 characters.
- Validation: the token address must pass strict checksum validation in the server before any upstream call.
- Failure behaviour: provider errors become a user-facing message. No finding is invented, and absence of findings is explicitly **not** a safety signal.

The response is returned as untrusted publisher data and rendered as text in the UI. It is token-level research, not a risk rating, audit or endorsement.
