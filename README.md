# Even Hand

Fair on-chain escrow arbitration on GenLayer.

## Walkthrough

**1. Buyer creates a dispute.** The buyer escrows the disputed amount in GEN and submits the listing terms together with their evidence (at least 25 characters each). The case enters the `awaiting seller` state.

**2. Seller responds.** The seller provides their counter-evidence. Both sides are now on record, and the case becomes `ready` for a ruling.

**3. Validators adjudicate.** A GenLayer leader runs an LLM prompt that reads the listing terms, buyer evidence, and seller evidence. The prompt asks for a `buyer_share` (0–100, the percentage of escrow the buyer deserves) and a rationale. Validators re-execute the same prompt and must agree on the share within a 15‑point tolerance. The verdict maps from the share:

| Buyer share | Verdict |
|---|---|
| ≥ 67 | `BUYER_FAVORED` |
| 34–66 | `SPLIT` |
| ≤ 33 | `SELLER_FAVORED` |

**4. Release funds.** The losing party pays a 5 % fee (500 bps on their gross escrow portion). The fee flows into the contract’s fee pool. Winners and the contract split the escrow according to the verdict.

The contract distinguishes four classes of error: `[EXPECTED]`, `[EXTERNAL]`, `[TRANSIENT]`, and `[LLM_ERROR]`. Validators handle each according to the fault code.

## Contract

- **Network:** GenLayer Studionet (chain 61999)
- **Address:** `0x0648DEF4A27cd3d77584A0B2F6B4d6daB5aA6a1D`
- **Language:** Python (py-genlayer)

## Stack

- React 18 + TypeScript + Vite
- wagmi + RainbowKit + genlayer-js
- framer-motion (animated split bar)
- @phosphor-icons/react
- FluidParticles background

## Commands

```sh
cd frontend
npm install
npm run dev      # http://localhost:5380
npm run build    # dist/
```

## License

MIT
