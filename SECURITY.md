## Security hardening checklist

This file documents actions taken and recommended next steps. Do NOT store secrets in the repository.

Immediate actions taken:
- Added sensitive patterns to .gitignore and untracked committed files.
- Added CI workflow `.github/workflows/secret-scan.yml` to run `detect-secrets` and dependency audits.
- Enabled Dependabot via `.github/dependabot.yml`.
- Added `pre-commit` config to run `detect-secrets` locally.

Recommended actions (you should perform):
1. Rotate all secrets that were present in commits (DB password, AWS keys, Postmark, Slack, YouTube, Pusher, etc.).
2. Purge secrets from git history (BFG or git-filter-repo). This rewrites history and requires force-push.
3. Enable branch protection and require PR reviews + passing CI before merge.
4. Revoke leaked keys and update CI / deployment secrets.

If you want, run `do-all` script via the devops team to coordinate history rewrite and rotation.
