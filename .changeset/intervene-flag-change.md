---
"playingpack": minor
---

Replace `--intervene` flag with `--no-intervene` for CLI consistency

- Changed from opt-in `--intervene` to opt-out `--no-intervene` flag
- Intervention mode is now enabled by default (matches existing config default)
- Updated all CI/CD examples to include `--no-intervene` to prevent pipeline hangs
- Updated documentation in both root and package README files
