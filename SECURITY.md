## Security hardening checklist

This file documents actions taken and recommended next steps. Do NOT store secrets in the repository.

Immediate actions taken:
- Added sensitive patterns to .gitignore and untracked committed files.
- Purged sensitive files from git history and force-pushed rewritten refs.
- Added CI workflow `.github/workflows/secret-scan.yml` to run secret and dependency scans.
- Added CodeQL scanning workflow `.github/workflows/codeql.yml`.
- Enabled Dependabot via `.github/dependabot.yml`.
- Added `pre-commit` config to run `detect-secrets` locally.

Recommended actions (you should perform):
1. Rotate all secrets that were present in commits (DB password, AWS keys, Postmark, Slack, YouTube, Pusher, etc.).
2. Revoke leaked keys and invalidate all active sessions/tokens.
3. Enable branch protection and require PR reviews + passing CI before merge.
4. Move all production secrets to GitHub Encrypted Secrets or your vault.

## Credential rotation runbook

Execute this checklist immediately after any secret exposure:

1. Database credentials
- Rotate `DB_PASSWORD` and, if possible, `DB_USERNAME`.
- Restart app workers after updating environment secrets.

2. Cloud credentials
- Rotate `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`.
- Remove old IAM keys and verify only minimum IAM permissions remain.

3. Mail and messaging credentials
- Rotate `MAIL_USERNAME` and `MAIL_PASSWORD`.
- Rotate `PUSHER_APP_KEY` and `PUSHER_APP_SECRET`.

4. Third-party OAuth/API credentials
- Rotate `YOUTUBE_CLIENT_SECRET`, `POSTMARK_API_KEY`, `RESEND_API_KEY`, `SLACK_BOT_USER_OAUTH_TOKEN` and any other API keys.

5. Laravel app/session secrets
- Regenerate and rotate `APP_KEY` only during a maintenance window (this invalidates encrypted cookies/sessions).
- Invalidate active sessions and personal access tokens.

6. Post-rotation validation
- Confirm login, reset password, notifications, and file upload/download still work.
- Run CI security workflows and verify zero high vulnerabilities.
- Document rotation timestamp and owner.

If you want, run `do-all` script via the devops team to coordinate history rewrite and rotation.
