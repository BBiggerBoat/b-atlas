# B-Atlas v6.74.0 — Navigation, Saved Models & Transfer Cleanup

## Navigation / refresh
- Fixed initial routing so refreshing `/#find-your-boat`, `/#boat-models`, and `/#help-build-b-atlas` restores the same view instead of returning to Home.
- Preserved `/saved-models/`, `/about/`, and `/privacy/` page routes on refresh.
- Preserved Saved Models transfer fragments during initial routing so transfer links are not stripped before import.

## Saved Models
- Replaced separate Watch and Compare selection columns with one Select column.
- Added Select All for the currently visible Saved Models.
- Consolidated bulk actions at the top: Compare, Move / Share, Create Boat Watch, Remove.
- Removed per-row Remove buttons; Notebook remains a model-specific action.
- Compare accepts 2–4 selected models. Move / Share, Boat Watch and Remove use the same selected set.

## Move / Share
- Transfer now uses the models selected on the Saved Models page.
- Removed the redundant Models to include selector.
- Renamed Copy Transfer Link to Copy Link.
- Transfer URLs always target `/saved-models/`.
- Fixed pasted transfer links by processing an existing transfer fragment at page load and preserving that fragment through router initialization.

## Interface
- Added `v6.74.0` version badge to the bottom-right of the Home page.
- Added a new right-facing Sportfisher icon in the same navy/blue visual family as the other boat-family icons.

## Search indexing
- Updated sitemap `lastmod` for the Home and About pages to 2026-09-08.
- Saved Models remains `noindex, follow`, because it is a personal/local workspace rather than indexable public content.
