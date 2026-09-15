# B-Atlas v7.06.2 SEO deployment checklist

1. Deploy the complete v7.06.2 Primary Site package.
2. Confirm these URLs return HTTP 200 in a private/incognito browser:
   - https://b-atlas.org/
   - https://b-atlas.org/find-your-boat/
   - https://b-atlas.org/models/
   - https://b-atlas.org/boats/
   - https://b-atlas.org/manufacturers/
   - https://b-atlas.org/about/
   - https://b-atlas.org/robots.txt
   - https://b-atlas.org/sitemap.xml
   - https://b-atlas.org/7ec2c4a2ebce4b11a764cb71628ae16c.txt
3. In Bing Webmaster Tools, submit/refresh `https://b-atlas.org/sitemap.xml`.
4. Use URL Inspection on the homepage, `/models/`, `/find-your-boat/`, and 2–3 representative model pages, then request indexing.
5. Submit the newly deployed URLs through IndexNow. If deploying from a local copy with Node 18+, run:
   `node developer/submit-indexnow.js`
6. In Google Search Console, resubmit the sitemap and request indexing for the same small representative set. Do not manually request all 352 pages; let the sitemap and internal links handle the site-wide crawl.
7. Leave the site stable for crawl evaluation. Avoid changing canonical paths, titles, or sitemap structure for several days unless a real error is found.

## What to watch
- Bing Webmaster Tools: crawled pages, indexed pages, crawl errors and search impressions.
- Google Search Console: indexing status, discovered/crawled pages, impressions and queries.
- Queries should increasingly be non-brand searches such as model specifications, beam limits, fuel consumption and boat-type/size questions rather than only `B-Atlas`.
