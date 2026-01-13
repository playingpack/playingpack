# PlayingPack

**Chrome DevTools for AI Agents** - A local reverse proxy and debugger for intercepting, recording, and mocking LLM API calls.

Works with any OpenAI API-compatible provider: OpenAI, Ollama, Azure OpenAI, LiteLLM, vLLM, and more.

## Features

- **VCR Mode** - Record API responses and replay them deterministically (zero latency, zero cost)
- **Interceptor** - Pause requests on tool calls, inspect payloads, and decide what to do
- **Mock Editor** - Inject custom responses with Monaco editor (JSON syntax highlighting)
- **Real-time Dashboard** - Watch requests stream in with live status updates
- **SSE Streaming** - Full OpenAI-compatible streaming with proper chunk handling

## Configuration

Create `playingpack.config.jsonc` in your project root. See [playingpack.config.jsonc](playingpack.config.jsonc) for all available options.

```jsonc
{
  // Any OpenAI API-compatible endpoint (default: https://api.openai.com)
  "upstream": "http://localhost:11434/v1",

  // Directory for tape storage (default: .playingpack/tapes)
  "tapesDir": "path/to/tapes",

  // auto | off | replay-only (default: auto)
  "record": "auto"
}
```

CLI flags override config file values.

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
Your Agent  →  PlayingPack (localhost:3000)  →  Upstream API
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

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /v1/chat/completions` | OpenAI-compatible chat endpoint |
| `GET /ws` | WebSocket for real-time updates |
| `/api/trpc/*` | TRPC API routes |
| `GET /` | Dashboard UI |

## License

MIT
