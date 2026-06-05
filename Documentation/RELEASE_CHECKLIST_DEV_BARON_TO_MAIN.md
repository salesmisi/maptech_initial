# Release Checklist: dev/baron -> main

Use this checklist before and during release to keep deployment safe and repeatable.

## 1) Pre-merge checks

- Confirm branch is up to date:
  - `git checkout dev/baron`
  - `git pull origin dev/baron`
- Confirm CI workflows are green on `dev/baron`:
  - `CI`
  - `Secret Scanning & Audit`
  - `CodeQL`
- Confirm security scans:
  - `npm audit` reports 0 high/critical
  - `composer audit --ignore-unreachable` reports no advisories
- Confirm test/build quality gates:
  - `vendor/bin/phpunit --colors=always`
  - `vendor/bin/phpstan analyse app --no-progress`
  - `npx eslint "resources/js/src/**/*.{ts,tsx}" --max-warnings=0`
  - `npm run build`

## 2) Merge steps

- Merge via PR (recommended) with required approvals and required status checks.
- If merging locally:
  - `git checkout main`
  - `git pull origin main`
  - `git merge --no-ff dev/baron`
  - `git push origin main`

## 3) Post-merge deployment smoke tests

- Authentication:
  - login/logout
  - password reset and OTP flow
- Reporting/export:
  - Audit logs export to CSV, Excel, and PDF
  - Verify Details field renders readable sentence format
- Core product flows:
  - course viewer, notifications, enrollments
- Security headers and cookie behavior in production

## 4) Security operations after release

- Rotate all production credentials if not yet rotated.
- Confirm old secrets are revoked/inactive.
- Verify branch protection remains enabled on `main`.
- Keep security workflows mandatory for merge.

## 5) Rollback notes

- If rollback needed:
  - redeploy previous known-good build/artifact
  - revert merge commit on `main` using a new revert commit
  - do not force-push protected branches
