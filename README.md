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
| Expensive iteration | **VCR Mode** — Record once, replay forever. Zero API costs after first run. |
| Non-deterministic tests | **Tape playback** — Same request always returns same response. Deterministic by design. |
| Blind debugging | **Interceptor** — Pause before and after LLM calls. Inspect, edit, or mock at any point. |
| Slow feedback | **Instant replay** — Cached responses return in milliseconds, not seconds. |
| CI/CD reliability | **Replay-only mode** — Run tests against recorded tapes. Fast, free, deterministic. |

---

## Features

### VCR Mode
Record API responses and replay them deterministically. First request hits the real API and saves a "tape." Subsequent identical requests replay from cache with original timing preserved.

### Real-time Dashboard
Browser-based UI showing live request streaming, status updates, request/response inspection with syntax highlighting, and full history.

### Interceptor
Pause requests at two points in the lifecycle:
- **Before LLM call** — Inspect the request, edit it, use a cached response, or mock without calling the LLM
- **After LLM response** — When tool calls are detected, inspect the function name and arguments before allowing or mocking

Full control over request/response flow with the ability to inject mock responses at any point.

### Mock Editor
Monaco-powered JSON editor for crafting custom responses. Test error scenarios, edge cases, or specific tool call results without touching the real API.

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
# First run: records responses to .playingpack/tapes/
npx playingpack start &
pytest tests/

# Subsequent runs: replays from cache (instant, free)
npx playingpack start --record replay-only &
pytest tests/
```

Your tests become:
- **Fast** — Milliseconds instead of seconds per request
- **Free** — Zero API costs after initial recording
- **Deterministic** — Same input always produces same output
- **Offline-capable** — No network required

### Debugging Agent Behavior

Enable pause mode to intercept requests and inspect what your agent is doing:

**Pre-request interception (before LLM call):**
1. Start PlayingPack and open the dashboard
2. Toggle "Pause" mode in the UI (tool-calls or all)
3. Run your agent
4. Every request pauses before being sent to the LLM
5. You can:
   - **Allow** — Send the original request to the LLM
   - **Edit** — Modify the request body, then send
   - **Use Cache** — Replay from cache if available (saves API costs)
   - **Mock** — Return a mock response without calling the LLM

**Post-response interception (after LLM response):**
1. When the LLM returns a tool call, the request pauses
2. Inspect the function name, arguments, and full context
3. Click "Allow" to send the response to your agent, or "Mock" to inject a custom response

### CI/CD Integration

Run your test suite against recorded tapes in CI:

```bash
# In your CI pipeline
npx playingpack start --no-ui --record replay-only &
sleep 2  # Wait for server
npm test
```

If a tape is missing, the request fails immediately — no surprise API calls in CI.

```yaml
# Example GitHub Actions step
- name: Run tests with PlayingPack
  run: |
    npx playingpack start --no-ui --record replay-only &
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

  // Directory for tape storage (default: .playingpack/tapes)
  tapesDir: '.playingpack/tapes',

  // Directory for logs (default: .playingpack/logs)
  logsDir: '.playingpack/logs',

  // Recording mode: 'auto' | 'off' | 'replay-only' (default: auto)
  // - auto: Record if no tape exists, replay if it does
  // - off: Always hit upstream, never record
  // - replay-only: Only replay from cache, fail if tape missing
  record: process.env.CI ? 'replay-only' : 'auto',

  // Server port (default: 4747)
  port: 4747,

  // Server host (default: 0.0.0.0)
  host: '0.0.0.0',

  // Run without UI in CI environments (default: false)
  headless: !!process.env.CI,

  // Pause mode: 'off' | 'tool-calls' | 'all' (default: off)
  // - off: No interception, requests flow through normally
  // - tool-calls: Pause when LLM makes a tool/function call
  // - all: Pause on every request
  pause: 'off',
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

  // CI: replay-only (fast, deterministic), Local: auto (record on miss)
  record: process.env.CI ? 'replay-only' : 'auto',

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
| `--tapes-dir <path>` | Directory for tape storage | `.playingpack/tapes` |
| `--record <mode>` | Recording mode (`auto`, `off`, `replay-only`) | `auto` |

### Examples

```bash
# Proxy to a local LLM (Ollama)
npx playingpack start --upstream http://localhost:11434/v1

# CI mode: replay only, no UI, fail if tape missing
npx playingpack start --no-ui --record replay-only

# Custom port and tapes directory
npx playingpack start --port 8080 --tapes-dir ./test/fixtures/tapes

# Production OpenAI with custom tapes location
npx playingpack start --tapes-dir ./recordings
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
3. **Pre-intercept?** → If pause enabled, wait for user action (allow/edit/cache/mock)
4. **Cache hit?** → Replay tape with original timing
5. **Cache miss?** → Forward to upstream, stream response, record tape
6. **Tool call detected?** → Optionally pause for inspection (post-intercept)
7. **Response complete** → Save tape, notify dashboard

### State Machine

```
LOOKUP → (pause enabled) → PRE_INTERCEPT
                               ↓
              ┌────────────────┼────────────────┬─────────────────┐
              ↓                ↓                ↓                 ↓
         REPLAY           INJECT          CONNECT            CONNECT
        (cache)           (mock)         (allow)        (edit + allow)
              ↓                ↓                ↓                 ↓
          COMPLETE         COMPLETE       STREAMING          STREAMING
                                              ↓                   ↓
                              (tool call + pause enabled)         │
                                              ↓                   │
                                          INTERCEPT               │
                                              ↓                   │
                                 ┌────────────┴────────────┐      │
                                 ↓                         ↓      │
                            FLUSH (allow)             INJECT (mock)
                                 ↓                         ↓      │
                              COMPLETE                 COMPLETE   │
                                                                  ↓
                                                              COMPLETE

(Without pause enabled: LOOKUP → cache hit → REPLAY → COMPLETE
                        LOOKUP → cache miss → CONNECT → STREAMING → COMPLETE)
```

### Tape Format

Tapes are stored as JSON files named by request hash:

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
- Result: SHA-256 hash used as tape filename

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
│   │   ├── tape/      # Recording & playback
│   │   ├── interceptor/  # Session state machine
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

**Q: How do I update recordings when my prompts change?**
A: Delete the relevant tapes from `.playingpack/tapes/` and run your tests again. New tapes will be recorded automatically.

**Q: Does it work with function calling / tool use?**
A: Yes. PlayingPack fully supports OpenAI's function calling and tool use. The interceptor can pause specifically on tool calls for inspection.

**Q: Can I share tapes with my team?**
A: Yes. Commit your `.playingpack/tapes/` directory to version control. Everyone on the team gets the same deterministic behavior.

---

## License

[BUSL-1.1](LICENSE) (Business Source License)

Copyright 2025 Geoptly Intelligence Inc.

The Licensed Work is provided for non-production use. For production use, please contact us for a commercial license.
