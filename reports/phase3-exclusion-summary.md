# Phase 3: discovery and exclusion corrections

The discovery engine now applies the same rule throughout: exclude a boat when known information conflicts; retain it when the required information is unknown.

Implemented on `dev/phase3-exclusion`:

- Corrected drive-category relationships, including V-drives within Shaft, and read authoritative hull-material classifications before descriptive wording.
- Preserved unknown, optional and ambiguous values. An unspecified inboard drive remains uncertain when its subtype is needed.
- Evaluated combined dimensions, route limits and engine requirements within the same documented version/configuration. Independent alternatives are not combined into a purported confirmed match. Incomplete evidence retains an uncertain candidate.
- Applied search-control changes immediately on desktop and phones. Saved requirements survive editing, saving, clearing/restoring and reloading, including requirements without visible controls.
- Added visible draft/air-clearance limits and pod/jet/three-engine choices. Results distinguish confirmed matches, version-dependent matches and boats retained because information is missing. Preference uncertainty is shown separately from confirmed non-matches.

Verification includes the original **103 audit cases**, **24 additional safeguards**, **14,925 evaluations across all 995 models**, the existing application/release suite, and local browser workflows at desktop and phone screen sizes. Browser checks include saving, clearing, restoring, reloading, hidden requirements, text search and combined fuel/material/drive/count/dimension controls. Tests run against the built website package; external browser requests are blocked.

The database architecture and model values remain unchanged from the eight separately approved propulsion corrections, included in this development branch. No further model research or historical reconciliation was performed. Historical reports remain preserved. Tests of contribution handling use isolated local storage; live contributions are untouched.

Remaining limits: missing model data intentionally stays unknown, and incomplete configuration evidence is not promoted to certainty. Phone testing uses Edge screen/touch emulation; physical-device and Safari verification are outside the completed browser coverage.

Release requires passing final verification and the owner's explicit production approval. No merge or deployment is part of this assignment.
