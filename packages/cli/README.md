# PlayingPack

[![CI](https://github.com/geoptly/playingpack/actions/workflows/ci.yml/badge.svg)](https://github.com/geoptly/playingpack/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/playingpack.svg)](https://www.npmjs.com/package/playingpack)
[![License: BUSL-1.1](https://img.shields.io/badge/License-BUSL--1.1-yellow.svg)](LICENSE)

**Chrome DevTools for AI Agents** — A local reverse proxy and debugger for intercepting, recording, and replaying LLM API calls.

Point your AI agent at PlayingPack instead of your LLM provider, and get a real-time dashboard to watch requests, pause on tool calls, inject mock responses, and replay cached responses with zero latency and zero cost.

Works with any OpenAI API-compatible provider: OpenAI, Ollama, Azure OpenAI, LiteLLM, vLLM, and more.

---

## Why PlayingPack?

Building AI agents is painful:

- **Expensive iteration** — Every test run burns API credits. Debugging a single edge case can cost dollars.
- **Non-deterministic behavior** — LLMs return different responses each time, making tests flaky and debugging a guessing game.
- **Blind debugging** — You can't see what tool calls the agent made or why it chose a particular action.
- **Slow feedback loops** — Waiting seconds for API responses on every iteration kills productivity.
- **CI/CD nightmares** — You can't run reliable automated tests against a non-deterministic, rate-limited API.

PlayingPack solves these problems:

| Problem | Solution |
|---------|----------|
| Expensive iteration | **Cache Mode** — Record once, replay forever. Zero API costs after first run. |
| Non-deterministic tests | **Cache playback** — Same request always returns same response. Deterministic by design. |
| Blind debugging | **Intervene Mode** — Pause before and after LLM calls. Inspect, edit, or mock at any point. |
| Slow feedback | **Instant replay** — Cached responses return in milliseconds, not seconds. |
| CI/CD reliability | **Read-only cache** — Run tests against cached responses. Fast, free, deterministic. |

---

## Features

### Cache Mode
Record API responses and replay them deterministically. First request hits the real API and saves the response to cache. Subsequent identical requests replay from cache with original timing preserved.

### Real-time Dashboard
Browser-based UI showing live request streaming, status updates, request/response inspection with syntax highlighting, and full history.

### Intervene Mode
Pause requests at two points in the lifecycle:
- **Before LLM call** — Inspect the request, edit it, use a cached response, or mock without calling the LLM
- **After LLM response** — Inspect the response before it reaches your agent, modify or mock as needed

Full control over request/response flow with the ability to inject mock responses at any point.

### SSE Streaming
Full OpenAI-compatible streaming with proper chunk handling. Parses tool calls in real-time. Works exactly like the real API.

### Multi-Provider Support
Drop-in replacement for any OpenAI API-compatible endpoint:
- OpenAI
- Ollama (local LLMs)
- Azure OpenAI
- LiteLLM
- vLLM
- Any compatible endpoint

---

## Requirements

- **Node.js 20+**

---

## Installation

```bash
# npm
npm install -g playingpack

# pnpm
pnpm add -g playingpack

# yarn
yarn global add playingpack

# Or run directly with npx (no install)
npx playingpack start
```

---

## Quick Start

### 1. Start the proxy

```bash
npx playingpack start
```

### 2. Point your agent at PlayingPack

**Python (OpenAI SDK)**
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4747/v1",
    api_key="your-api-key"  # Still needed for upstream
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

**TypeScript/JavaScript**
```typescript
import OpenAI from 'openai';

const client = new OpenAI({
    baseURL: 'http://localhost:4747/v1',
    apiKey: process.env.OPENAI_API_KEY,
});

const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
});
```

**cURL**
```bash
curl http://localhost:4747/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### 3. Open the dashboard

Navigate to [http://localhost:4747](http://localhost:4747) in your browser.

---

## Use Cases

### Deterministic Testing

Record your agent's API interactions once, then replay them in tests forever:

```bash
# First run: records responses to .playingpack/cache/
npx playingpack start &
pytest tests/

# Subsequent runs: replays from cache (instant, free)
npx playingpack start --cache read &
pytest tests/
```

Your tests become:
- **Fast** — Milliseconds instead of seconds per request
- **Free** — Zero API costs after initial recording
- **Deterministic** — Same input always produces same output
- **Offline-capable** — No network required

### Debugging Agent Behavior

Enable intervene mode to pause requests and inspect what your agent is doing:

1. Start PlayingPack with `--intervene` flag or enable in the dashboard
2. Run your agent
3. At **Point 1** (before LLM call), choose:
   - **Allow** — Send the original request to the LLM
   - **Use Cache** — Replay from cache if available (saves API costs)
   - **Mock** — Return a mock response without calling the LLM
4. At **Point 2** (after LLM response), choose:
   - **Return** — Send the response to your agent as-is
   - **Modify** — Edit the response before sending to your agent

### CI/CD Integration

Run your test suite against cached responses in CI:

```bash
# In your CI pipeline
npx playingpack start --no-ui --cache read &
sleep 2  # Wait for server
npm test
```

If a cached response is missing, the request fails immediately — no surprise API calls in CI.

```yaml
# Example GitHub Actions step
- name: Run tests with PlayingPack
  run: |
    npx playingpack start --no-ui --cache read &
    sleep 2
    npm test
```

### Local Development with Ollama

Proxy to a local LLM for free, fast development:

```bash
# Start Ollama
ollama serve

# Point PlayingPack at Ollama
npx playingpack start --upstream http://localhost:11434/v1
```

Now your agent talks to your local LLM through PlayingPack, and you still get recording, replay, and debugging.

### Cost Reduction

During development, avoid burning through API credits:

1. Record a representative set of interactions
2. Iterate on your agent logic using cached responses
3. Only hit the real API when you need fresh recordings

Typical savings: 90%+ reduction in API costs during development.

---

## Configuration

Create `playingpack.config.ts` (or `.js`, `.mjs`) in your project root:

```typescript
import { defineConfig } from 'playingpack';

export default defineConfig({
  // Upstream API endpoint (default: https://api.openai.com)
  upstream: process.env.LLM_API_URL ?? 'https://api.openai.com',

  // Cache mode: 'off' | 'read' | 'read-write' (default: read-write)
  // - off: Always hit upstream, never cache
  // - read: Only read from cache, fail if missing
  // - read-write: Read from cache if available, write new responses
  cache: process.env.CI ? 'read' : 'read-write',

  // Intervene mode: pause for human inspection (default: true)
  intervene: true,

  // Directory for cache storage (default: .playingpack/cache)
  cachePath: '.playingpack/cache',

  // Directory for logs (default: .playingpack/logs)
  logPath: '.playingpack/logs',

  // Server port (default: 4747)
  port: 4747,

  // Server host (default: 0.0.0.0)
  host: '0.0.0.0',

  // Run without UI in CI environments (default: false)
  headless: !!process.env.CI,
});
```

### Environment-Aware Configuration

Using a JS/TS config file allows dynamic configuration based on environment:

```typescript
import { defineConfig } from 'playingpack';

export default defineConfig({
  // Use different upstream for local vs CI
  upstream: process.env.CI
    ? 'https://api.openai.com'
    : 'http://localhost:11434/v1',

  // CI: read-only (fast, deterministic), Local: read-write (record on miss)
  cache: process.env.CI ? 'read' : 'read-write',

  // No UI needed in CI
  headless: !!process.env.CI,
});
```

### Supported Config Files

Config files are loaded in this order (first found wins):

1. `playingpack.config.ts` (recommended)
2. `playingpack.config.mts`
3. `playingpack.config.js`
4. `playingpack.config.mjs`
5. `playingpack.config.jsonc` (legacy)
6. `playingpack.config.json` (legacy)

CLI flags override config file values.

---

## CLI Reference

```bash
npx playingpack start [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port <port>` | Port to listen on | `4747` |
| `-h, --host <host>` | Host to bind to | `0.0.0.0` |
| `--no-ui` | Run without UI (headless mode) | `false` |
| `--upstream <url>` | Upstream API URL | `https://api.openai.com` |
| `--cache-path <path>` | Directory for cache storage | `.playingpack/cache` |
| `--cache <mode>` | Cache mode (`off`, `read`, `read-write`) | `read-write` |
| `--intervene` | Enable human intervention mode | `true` |

### Examples

```bash
# Proxy to a local LLM (Ollama)
npx playingpack start --upstream http://localhost:11434/v1

# CI mode: read-only cache, no UI, fail if cache missing
npx playingpack start --no-ui --cache read

# Custom port and cache directory
npx playingpack start --port 8080 --cache-path ./test/fixtures/cache

# Enable intervention mode for debugging
npx playingpack start --intervene
```

---

## How It Works

### Architecture

```
Your Agent  →  PlayingPack (localhost:4747)  →  Upstream API
                      ↓
                Dashboard UI
                - View requests in real-time
                - Pause & inspect tool calls
                - Mock responses
                - Replay from cache
```

### Request Flow

1. **Request arrives** at `POST /v1/chat/completions`
2. **Cache lookup** — Request body is normalized and hashed (SHA-256)
3. **Intervention Point 1?** → If intervene enabled, wait for user action (allow/cache/mock)
4. **Get response** → From cache (if available) or upstream LLM
5. **Intervention Point 2?** → If intervene enabled, wait for user action (return/modify)
6. **Response complete** → Save to cache (if enabled), notify dashboard

### Simple Mental Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PlayingPack                                  │
│                                                                      │
│   Cache: System remembers responses (read/write/off)                │
│   Intervene: Human can inspect/modify at two points                 │
│                                                                      │
│   Request → [Point 1: Before LLM] → Response → [Point 2: After] →   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Cache Format

Cached responses are stored as JSON files named by request hash:

```json
{
  "meta": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "hash": "a1b2c3d4e5f6...",
    "timestamp": "2025-01-13T10:30:00.000Z",
    "model": "gpt-4",
    "endpoint": "/v1/chat/completions"
  },
  "request": {
    "body": { "model": "gpt-4", "messages": [...] }
  },
  "response": {
    "status": 200,
    "chunks": [
      { "c": "data: {\"id\":\"chatcmpl-...\"}\n\n", "d": 50 },
      { "c": "data: {\"id\":\"chatcmpl-...\"}\n\n", "d": 30 },
      { "c": "data: [DONE]\n\n", "d": 10 }
    ]
  }
}
```

- `c` = chunk content (SSE data)
- `d` = delay in milliseconds since previous chunk

### Request Hashing

Requests are normalized before hashing to ensure deterministic matching:
- Keys are sorted alphabetically
- `stream` parameter is ignored (streaming and non-streaming match)
- Timestamps and request IDs are removed
- Result: SHA-256 hash used as cache filename

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /v1/chat/completions` | OpenAI-compatible chat endpoint (proxied) |
| `GET /v1/*` | Other OpenAI endpoints (passthrough) |
| `GET /ws` | WebSocket for real-time dashboard updates |
| `ALL /api/trpc/*` | TRPC API for dashboard |
| `GET /health` | Health check |
| `GET /` | Dashboard UI |

---

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for full details.

```bash
# Clone and install
git clone https://github.com/geoptly/playingpack.git
cd playingpack
pnpm install

# Run in development mode (hot reload)
pnpm dev

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint and format
pnpm lint
pnpm format

# Build for production
pnpm run build:all
```

### Project Structure

```
playingpack/
├── packages/
│   ├── shared/        # TypeScript types & Zod schemas
│   ├── cli/           # Fastify proxy server + CLI
│   │   ├── proxy/     # HTTP routing, upstream client, SSE parsing
│   │   ├── cache/     # Response caching & playback
│   │   ├── session/   # Session state management
│   │   ├── mock/      # Synthetic response generation
│   │   ├── trpc/      # API procedures
│   │   └── websocket/ # Real-time events
│   └── web/           # React dashboard
│       ├── components/
│       ├── stores/    # Zustand state
│       └── lib/       # TRPC & WebSocket clients
```

---

## FAQ

**Q: Does PlayingPack modify my requests?**
A: No. Requests are forwarded to upstream unchanged. The only modification is adding proxy headers for debugging.

**Q: Can I use this in production?**
A: PlayingPack is designed for development and testing. For production, point your agents directly at your LLM provider.

**Q: How do I update cached responses when my prompts change?**
A: Delete the relevant files from `.playingpack/cache/` and run your tests again. New responses will be cached automatically.

**Q: Does it work with function calling / tool use?**
A: Yes. PlayingPack fully supports OpenAI's function calling and tool use.

**Q: Can I share cached responses with my team?**
A: Yes. Commit your `.playingpack/cache/` directory to version control. Everyone on the team gets the same deterministic behavior.

---

## License

[BUSL-1.1](LICENSE) (Business Source License)

Copyright 2025 Geoptly Intelligence Inc.

The Licensed Work is provided for non-production use. For production use, please contact us for a commercial license.
