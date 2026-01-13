# PlayingPack

**Chrome DevTools for AI Agents** - A local reverse proxy and debugger for intercepting, recording, and mocking OpenAI API calls.

## Features

- **VCR Mode** - Record API responses and replay them deterministically (zero latency, zero cost)
- **Interceptor** - Pause requests on tool calls, inspect payloads, and decide what to do
- **Mock Editor** - Inject custom responses with Monaco editor (JSON syntax highlighting)
- **Real-time Dashboard** - Watch requests stream in with live status updates
- **SSE Streaming** - Full OpenAI-compatible streaming with proper chunk handling

## Quick Start

```bash
npx playingpack start
```

Then configure your AI agent to use the proxy:

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:3000/v1")
```

Open http://localhost:3000 in your browser to access the dashboard.

## CLI Options

```bash
npx playingpack start [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port <port>` | Port to listen on | `3000` |
| `-h, --host <host>` | Host to bind to | `0.0.0.0` |
| `--no-ui` | Run without UI (headless mode) | - |
| `--upstream <url>` | Upstream API URL | `https://api.openai.com` |
| `--tapes-dir <path>` | Directory for tape storage | `.playingpack/tapes` |
| `--record <mode>` | Recording mode | `auto` |

### Recording Modes

| Mode | Description |
|------|-------------|
| `auto` | Record on cache miss, replay on hit (default) |
| `off` | Passthrough only, no recording or replay |
| `replay-only` | Replay only, fail if no tape exists (strict CI mode) |

### Examples

```bash
# Proxy to a local LLM (Ollama)
npx playingpack start --upstream http://localhost:11434/v1

# CI mode: replay only, no UI, fail if tape missing
npx playingpack start --no-ui --record replay-only

# Custom tapes directory
npx playingpack start --tapes-dir ./test/fixtures/tapes
```

## How It Works

```
Your Agent  →  PlayingPack (localhost:3000)  →  OpenAI API
                    ↓
              Dashboard UI
              - View requests
              - Pause & inspect
              - Mock responses
              - Replay from cache
```

### State Machine

```
LOOKUP → (cache hit) → REPLAY → done
       ↘ (cache miss) → CONNECT → STREAMING → done
                                      ↓ (tool call detected)
                                  INTERCEPT (paused)
                                      ↓
                         ┌────────────┴────────────┐
                         ↓                         ↓
                    FLUSH (allow)             INJECT (mock)
                         ↓                         ↓
                       done                      done
```

## Project Structure

```
playingpack/
├── packages/
│   ├── shared/           # TypeScript types & Zod schemas
│   ├── cli/              # Fastify proxy server
│   │   ├── proxy/        # Routes, upstream, SSE parsing
│   │   ├── tape/         # Recording & playback
│   │   ├── interceptor/  # Session state machine
│   │   ├── mock/         # Synthetic response generator
│   │   ├── trpc/         # API procedures
│   │   └── websocket/    # Real-time events
│   └── web/              # React dashboard
│       ├── components/   # UI components
│       ├── stores/       # Zustand state
│       └── lib/          # TRPC & WebSocket clients
```

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

## Tech Stack

- **Runtime:** Node.js 20+
- **Language:** TypeScript (strict mode)
- **Server:** Fastify + TRPC + WebSocket
- **Frontend:** React + Vite + Tailwind + Zustand
- **Editor:** Monaco
- **Testing:** Vitest

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /v1/chat/completions` | OpenAI-compatible chat endpoint |
| `GET /ws` | WebSocket for real-time updates |
| `/api/trpc/*` | TRPC API routes |
| `GET /` | Dashboard UI |

## Configuration

PlayingPack can be configured via a config file. Create `playingpack.config.json` or `.playingpackrc.json` in your project root:

```jsonc
{
  // Upstream API URL
  "upstream": "https://api.openai.com",

  // Directory for tape storage
  "tapesDir": ".playingpack/tapes",

  // Recording mode: auto, off, replay-only
  "record": "auto",

  // Run without UI
  "headless": false,

  "port": 3000,
  "host": "0.0.0.0"
}
```

All fields are optional. Comments are supported. CLI flags override config file values.

### Tape Storage

Recorded responses are stored as JSON files, keyed by a SHA-256 hash of the normalized request body.

## License

MIT
