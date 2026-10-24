# Deployment checklist

Complete before exposing an instance to the public.

## Mandatory legal placeholders

- [ ] `[OPERATOR LEGAL NAME]` — in `LICENSE`, Terms, Privacy, AUP
- [ ] `[LEGAL CONTACT EMAIL]` — Terms, AUP, Contact page
- [ ] `[GOVERNING JURISDICTION]` — Terms, Privacy
- [ ] `[EFFECTIVE DATE]` — Terms, Privacy, AUP
- [ ] `[PRIVACY CONTACT]` — Privacy, Contact page
- [ ] `[SECURITY CONTACT EMAIL]` — SECURITY.md, Security page, Help
- [ ] `[CONDUCT CONTACT EMAIL]` — CODE_OF_CONDUCT.md
- [ ] `[SERVICE ADDRESS IF REQUIRED]` — Terms, Privacy
- [ ] `[COPYRIGHT HOLDER — ...]` — LICENSE

Update content in `src/content/legal/*.ts`, then run `npm run docs:legal` to refresh `docs/legal/*.md`.

Set `LEGAL_PLACEHOLDERS_RESOLVED=1` **only** after a legal review and after every placeholder is replaced. Until then the legal pages display a draft warning.

## Security

- [ ] `APP_SECRET` is 48+ random bytes and unique to this deployment
- [ ] HTTPS terminated at a reverse proxy; secure cookies active (`NODE_ENV=production`)
- [ ] `.env` and `data/` excluded from version control and backups are encrypted
- [ ] `EXECUTION_ENABLED` decision recorded (default `0`)
- [ ] `ALLOW_PRIVATE_CUSTOM_ENDPOINTS` remains `0` for multi-user instances
- [ ] GitHub App permissions reviewed (contents, metadata, pull requests)
- [ ] Rate limits and proxy request-size limits configured
- [ ] Log retention and secret-handling verified

## Product

- [ ] At least one verified-free or local provider reaches a successful chat
- [ ] An unauthorized user cannot read another user's chat/project (spot-check with two accounts)
- [ ] Paid model reference returns HTTP 403 from the API
- [ ] Execution allowlist verified; a rejected command shows a clear error
- [ ] Publishing refuses the default branch and refuses unapproved changes
- [ ] `.env` files are excluded from generated commits
- [ ] `npm run typecheck && npm run lint && npm test && npm run build` pass
- [ ] Password recovery: email delivery configured or the limitation is clearly communicated
- [ ] Backup/restore of the SQLite database and data directory tested

## Documentation

- [ ] README environment table matches `.env.example`
- [ ] `THIRD_PARTY_NOTICES.md` regenerated after dependency changes
- [ ] Changelog updated for the release
