# ChainScene

An evidence-first Solana transaction investigator. Paste a mainnet or devnet signature to inspect finalized transaction data, decoded transfers, exact account balance changes, program IDs, and recent account activity. An optional OpenAI narrative cites evidence IDs from the parsed transaction.

## Run locally

```powershell
npm.cmd ci
npm.cmd run dev
```

Open `http://localhost:3000`. Click **Try live example** to analyze a successful mainnet transaction. No wallet or API key is needed for the onchain investigation.

To enable AI explanations, enter your OpenAI API key in **Enable AI narrative** for the current browser session. The key is sent to the server for that request, used for the model call, and is not saved by ChainScene. Alternatively, configure `OPENAI_API_KEY` on the server. Copy `.env.example` to `.env.local` for local configuration. On Vercel, set the variable in project settings. `SOLANA_RPC_URL` and `SOLANA_DEVNET_RPC_URL` can point to dedicated RPC providers; the app otherwise uses public Solana RPC.

## How evidence works

- The server calls Solana `getTransaction` with `jsonParsed` and `finalized` commitment.
- SOL and token balance changes are calculated from the transaction's pre/post balances. Large integer values are parsed without floating-point precision loss.
- Transfer edges come only from successful, parsed System Program and SPL Token transfer instructions, including inner instructions. Unknown instructions are counted and disclosed.
- Clicking an account requests its latest 12 finalized signatures with `getSignaturesForAddress`. This is recent account activity, **not** a proven continuation of the investigated transfer.
- **Scan next hops** checks up to four recipient accounts, their latest 20 signatures each, and up to six nearby transactions. It reports later outgoing transfers from the same account, with a two-hour window and explicit coverage limits. Fungible units cannot be tracked individually.
- An optional model creates a narrative from the extracted facts. Claims with missing or unknown evidence IDs are discarded. ID matching does not prove the model interpreted the evidence correctly, so the source records remain inspectable.

The app does not establish identity, intent, fraud, or a complete fund trail from a single signature. Public RPC endpoints may rate limit requests and may have limited historical coverage.

## Checks

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

## Stack

Next.js App Router, TypeScript, Solana JSON-RPC, React Flow, and optional OpenAI Responses API. The application is read-only and does not ask users to connect or sign with a wallet.
