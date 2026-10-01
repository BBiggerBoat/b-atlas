# B-Atlas contribution email notifications

B-Atlas can send a moderator notification after a contribution has been saved successfully to D1.

## Binding

Configure a Cloudflare Worker email binding named:

`CONTRIBUTION_EMAIL`

Restrict the binding to one verified destination address in the Cloudflare dashboard.

The Worker sends from:

`notifications@b-atlas.org`

The notification contains only:

- contribution type
- model/manufacturer/variant when present
- submission timestamp
- contribution ID
- link to Contribution Review

It does not include contributor email addresses, attachment contents, or full submission text.

## Failure behavior

Email is non-critical. The contribution is saved before notification is attempted.

If email delivery fails, the contribution remains in the moderation queue. The Worker logs the notification error but does not return a failed contribution response.

## Cloudflare setup

1. Enable Email Routing for `b-atlas.org`.
2. Add and verify the moderator destination email under Email Routing → Destination Addresses.
3. In Worker `batlas-api`, add a Send Email binding:
   - variable name: `CONTRIBUTION_EMAIL`
   - destination: the verified moderator email
4. Deploy the current generated Worker.
5. Submit a harmless test contribution and confirm the email arrives.

No email address or credential is stored in GitHub.
