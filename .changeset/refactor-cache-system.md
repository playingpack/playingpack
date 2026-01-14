---
"playingpack": minor
---

Refactor: Replace tape system with simplified cache architecture

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
