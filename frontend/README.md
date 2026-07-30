# Even Hand

Fair on-chain escrow arbitration.

The contract logic runs fully on-chain. A decentralised panel of GenLayer validators reads the
submitted evidence, reaches consensus on the outcome, and stores the result on-chain so it cannot be
quietly changed after the fact.

## Contract

- Network: GenLayer Studionet
- Address: `0x0648DEF4A27cd3d77584A0B2F6B4d6daB5aA6a1D`

## Develop

```bash
npm install
npm run dev      # http://localhost:5380
```

## Build

```bash
npm run build    # static output in dist/
```

## Deploy

This is a static Vite single-page app. Push this folder to a GitHub repository and import it on
Vercel (no configuration needed), or run `npx vercel` from here. The included `vercel.json`
handles single-page-app routing.