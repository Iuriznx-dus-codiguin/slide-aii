# Presentation hosting retention (cost reduction)
- [ ] Database: hosting rules, offline marking, restore on purchase, purge after 30 days, access checks (shared link, portfolio, slides, views).
- [ ] Payment events: refund takes decks offline now; credit purchase restores; renewal failure / cancel end-of-period / pause follow the rule.
- [ ] Daily maintenance: mark offline, schedule notices, delete expired decks and their images.
- [ ] Edge functions: block AI edit, speech regeneration and link previews for offline decks.
- [ ] App: locked cards and restore banner in the dashboard, unavailable screen in viewer/editor, account notice.
- [ ] Emails: new offline / deletion-soon notices; fix copy that promised decks stay forever.
- [ ] Terms of Use, Privacy Policy (new versions), help articles, pricing/FAQ copy.
- [ ] Tests for the rules; deploy functions; verify.

# Landing page adjustments
- [x] Update badge and monthly PRO estimate; simplify MAX qualification.
- [x] Move FAQ to the end and tighten mobile/desktop layout and motion.
- [x] Verify pricing, navigation, FAQ and layout in the browser (360, 390, 768 and 1280px; no horizontal overflow or runtime errors; reduced-motion preference honored).

# Audit continuation
- [x] Confirm refund guard, feedback/cache/salt tables, cookie article and upload limits (Step 0).
- [x] Audit and update dependencies and verify MCP bundle parity (Step 2; bun.lockb removed per user request).
- [x] Align MCP credit balance with application entitlement and test it (Step 3).
- [x] Deploy the ten requested functions (Step 4; mcp withheld until next publish, platform behavior).
- [x] Run unit tests and verify authenticated generation, sharing, editing, exports, feedback and team metrics (Step 5).

# Prepared pricing updates
- [x] Check live quotas and balance impact (8 accounts, all balances zero).
- [x] Apply prepared updates 0017 then 0018 unchanged; verify recorded hashes and live quotas.
- [x] Compare all 84 published help articles with prepared content and run 64 pricing/payment/entitlement tests.

# Search plan execution and credit validation
- [x] Associate existing favicon and preserve the chosen homepage title.
- [x] Improve the existing creation guide and its homepage link.
- [x] Enrich academic and business template examples with review/export guidance.
- [x] Prepare directory outreach without sending; check advertising connection availability.
- [x] Validate code/live credit rules and authenticated modal; 456 unit tests and 11 integration checks passed, 2 skipped.
- [x] Update the saved marketing plan with verified outcomes and external blockers.
- [ ] Align five Cakto offers and confirm service fee (blocked: external Cakto offer management access).
- [ ] Verify real customer payment, debit, renewal and refund (blocked: corrected offers and authorized transaction/test account).
- [ ] Publish frontend and request guide indexing (blocked: publishing approval and manual Search Console indexing request).
- [ ] Send editorial pitch / review ads (blocked: sending approval / advertising account connection).
