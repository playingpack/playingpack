---
"playingpack": patch
---

Fix package.json path resolution in bundled output

The bundled code was referencing `../../package.json` instead of `../package.json`, causing module resolution errors when running via npx. The path is now correct relative to `dist/index.js`.
