# Configuration-aware filter — browser acceptance checklist

Pull request: #9. **Do not merge until the browser checks are recorded.**

## Setup
1. Use a preview deployment built from `test/correlated-config-filter-20261017`, **not** the production `b-atlas.org` main deployment.
2. In browser developer tools > Network, confirm `filterengine.js?v=7.06.4-configqa1` loads successfully (HTTP 200) and is not an old cached file.
3. Check the JavaScript console for errors before interacting with filters.

## Desktop checks
- [ ] Search for a known model by name; expected model appears.
- [ ] Fuel = Diesel; models with unknown fuel remain visible.
- [ ] Propulsion = Shaft; models with unknown propulsion remain visible.
- [ ] Engine count = 1; unknown engine count remains visible.
- [ ] Combine Diesel + Shaft + 1 engine; search results remain consistent.
- [ ] Save the combined filter profile, refresh, restore the profile; selected filters and results match.
- [ ] Show All resets the filtered results correctly.
- [ ] Create Boat Watch from a saved model; correct model name and canonical URL appear in the generated prompt.

## Mobile checks
- [ ] Repeat the combined Diesel + Shaft + 1 engine search on a narrow viewport.
- [ ] Change fuel and propulsion filters individually; results visibly update each time.
- [ ] Search for `Nimble` and `Riviera` separately; matching models appear.
- [ ] Save and restore a filter profile; checkboxes remain synchronized.
- [ ] Show All works; no horizontal overflow or blocked controls.
- [ ] Create Boat Watch from a saved model and inspect the generated prompt.

## Data-specific checks (use preview-only fixtures; do not contaminate canonical data)
- [ ] Verified gasoline/sterndrive/twin + diesel/shaft/single model matches diesel/shaft/single.
- [ ] The same model is rejected for diesel/sterndrive when the configuration set is exhaustive.
- [ ] Incomplete configuration sets retain otherwise conflicting candidates.
- [ ] Shaft V-drive matches Shaft, not Sterndrive.
- [ ] IPS pod matches Pod, not Shaft.
- [ ] Unknown values are retained, not eliminated.

## Merge gate
- [ ] Automated regression and deployment guard are green for the **latest** commit.
- [ ] Desktop and mobile checks above are complete.
- [ ] Any new exclusion reason is intelligible where rejection reasons are displayed.
- [ ] Merge approval is explicit; do not merge based only on automated tests.

Record browser, OS, test date, preview URL and any failing model IDs in PR #9.
