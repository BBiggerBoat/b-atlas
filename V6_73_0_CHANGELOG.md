# B-Atlas v6.73.0

## Page architecture
- Converted Saved Models from an overlay modal into a normal top-level page at `/saved-models/`.
- Converted About from an overlay modal into a normal top-level page at `/about/`.
- Added a normal `/privacy/` route for consistent information-page behaviour.
- Direct refreshes on Saved Models and About now reopen the requested page instead of returning to Home.
- Primary navigation remains usable while Saved Models and About are open.

## Saved Models
- Model names now render as real link elements rather than button elements, removing inherited primary-button blue backgrounds.
- Preserved Stage, Remove, Notebook, Compare, Boat Watch, and Move/Share functionality.
- Saved Models remains local-browser data; the page itself is marked `noindex`.

## Navigation
- Updated primary/footer navigation to permanent `/saved-models/` and `/about/` paths.
- Updated generated static Guide/manufacturer links away from the old hash-based Saved Models/About routes.
