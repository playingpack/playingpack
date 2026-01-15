# playingpack

## 0.7.0

### Minor Changes

- c484d92: Replace `--intervene` flag with `--no-intervene` for CLI consistency
  - Changed from opt-in `--intervene` to opt-out `--no-intervene` flag
  - Intervention mode is now enabled by default (matches existing config default)
  - Updated all CI/CD examples to include `--no-intervene` to prevent pipeline hangs
  - Updated documentation in both root and package README files

## 0.6.0

### Minor Changes

- 64bb14e: Redesign request labeling strategy for better developer clarity

  **Breaking Change:** Replaced `cacheHit: boolean` with `cacheAvailable: boolean` and `responseSource?: 'llm' | 'cache' | 'mock'`
  - Separated lifecycle state from response source into distinct badges
  - Updated lifecycle labels: WAITING → PAUSED, PROCESSING → CALLING, CACHED/DONE → DONE
  - Added new SourceBadge component showing LLM, CACHE, or MOCK
  - Completed requests now show both state (DONE) and source (LLM/CACHE/MOCK)
  - Renamed `cacheHit` to `cacheAvailable` to clarify it indicates cache availability, not usage
  - Added `responseSource` field to track where the response actually came from

## 0.5.2

### Patch Changes

- 7cdc23c: Fix package.json path resolution in bundled output

  The bundled code was referencing `../../package.json` instead of `../package.json`, causing module resolution errors when running via npx. The path is now correct relative to `dist/index.js`.

## 0.5.0

### Minor Changes

- bff212d: Refactor: Replace tape system with simplified cache architecture

  **Breaking Changes:**
  - Renamed `tapesDir` config option to `cachePath`
  - Renamed `record` config option to `cache` with values: `off`, `read`, `read-write`
  - Renamed `pause` config option to `intervene` (boolean)
  - Changed default cache directory from `.playingpack/tapes` to `.playingpack/cache`

  **New Features:**
  - Simplified mental model: Cache (remembers responses) + Intervene (human inspection)
  - New session manager with cleaner state management
  - Improved cache store with better organization

  **Removed:**
  - Old tape player/recorder system
  - Old interceptor heartbeat system
  - Inspector, MockEditor, and InterceptorToggle UI components (replaced with streamlined UI)

## 0.3.2

### Patch Changes

- 84b919d: Version sync with npm registry

## 0.3.1

### Patch Changes

- Sync version with npm registry

## 0.3.0

### Minor Changes

- 1630ab0: Improve UI and rename states for clarity
  - Action panel now always visible at bottom of UI (shows status when inactive)
  - Renamed internal states for better clarity:
    - `PRE_INTERCEPT` → `PAUSED` (request paused before LLM call)
    - `INTERCEPT` → `TOOL_CALL` (tool call detected, awaiting decision)
  - Status badges now show "PAUSED" and "TOOL CALL" labels
  - Release workflow configured to use prod environment

## 0.2.1

### Patch Changes

- 11d3d97: Honor `stream` parameter for non-streaming responses. Previously, PlayingPack always returned SSE streaming responses even when clients requested `stream: false`. This broke LangChain and other clients that expect JSON for non-streaming requests. Now the proxy transparently passes the stream parameter to upstream and returns responses in the appropriate format.

## 0.2.0

### Minor Changes

- c786da8: Initial release of PlayingPack - Chrome DevTools for AI Agents.

  Features:
  - VCR Mode: Record and replay LLM API responses deterministically
  - Real-time Dashboard: Browser-based UI for request inspection
  - Interceptor: Pause on tool calls, inspect payloads, inject mock responses
  - SSE Streaming: Full OpenAI-compatible streaming support
  - Multi-Provider: Works with OpenAI, Ollama, Azure OpenAI, LiteLLM, vLLM
  - TypeScript Config: `defineConfig` helper with full type safety
