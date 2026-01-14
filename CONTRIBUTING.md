# Contributing to PlayingPack

## Project Structure

```
playingpack/
├── packages/
│   ├── shared/           # TypeScript types & Zod schemas
│   ├── cli/              # Fastify proxy server
│   │   ├── proxy/        # Routes, upstream, SSE parsing
│   │   ├── cache/        # Response caching & playback
│   │   ├── session/      # Session state management
│   │   ├── mock/         # Synthetic response generator
│   │   ├── trpc/         # API procedures
│   │   └── websocket/    # Real-time events
│   └── web/              # React dashboard
│       ├── components/   # UI components
│       ├── stores/       # Zustand state
│       └── lib/          # TRPC & WebSocket clients
```

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript (strict mode)
- **Server:** Fastify + TRPC + WebSocket
- **Frontend:** React + Vite + Tailwind + Zustand
- **Editor:** Monaco
- **Testing:** Vitest

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode (hot reload)
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Build for production
pnpm run build:all
```
