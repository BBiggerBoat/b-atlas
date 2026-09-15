# B-Atlas v7.06.2 — SEO / Crawl + First-Visit Tour

Date: 2026-09-15

## Purpose
Improve search-engine crawlability and internal discovery while adding an optional, non-blocking first-visit orientation tour.

## Changes
- Added crawlable **How B-Atlas Works** homepage content with direct HTML links into model, manufacturer and buyer-intent pages.
- Added a crawlable **Popular research paths** section targeting real boat-research questions rather than the B-Atlas brand name.
- Added `/find-your-boat/` as a permanent, indexable landing page with a direct link into the interactive planning workflow.
- Changed homepage navigation fallback URLs to real crawlable routes while retaining SPA behavior for JavaScript users.
- Added an **optional 60-second first-visit tour**. It never blocks the underlying page and opens the full tour only after the visitor chooses Start Tour.
- Added an always-available **Take a 60-second tour** button on the homepage.
- Added Organization + WebSite structured data on the homepage.
- Rebuilt sitemap ordering to include Home, Find Your Boat, Models, Boats, Manufacturers and About explicitly.
- Normalized all public cache/version identifiers to `7.06.2`.
- Corrected stale version identifiers in About, Privacy and Saved Models application copies.
- Improved static model/manufacturer/boat/compare navigation to use permanent routes instead of hash-only application links.
- Kept Saved Models and Privacy `noindex, follow`; they are not included in the sitemap.
- Updated `robots.txt` and excluded `/developer/` from crawler access.
- Added `developer/submit-indexnow.js` to submit the complete current sitemap to IndexNow after deployment using the existing public key file.

## Tour / SEO rule
The tour is progressive enhancement. Search engines and visitors always receive the complete homepage content without having to dismiss or complete the tour.
- Replaced the old application-clone `/about/` page with a focused static About page so search engines receive a clear, unique document rather than another copy of the full application DOM.

## Validation
- 352 indexable canonical HTML pages found.
- 352 sitemap URLs found.
- Every indexable canonical URL is present in the sitemap.
- No duplicate canonical URLs detected.
- Key navigation/internal links resolve locally.
- First-visit tour and IndexNow helper pass JavaScript syntax checks.
