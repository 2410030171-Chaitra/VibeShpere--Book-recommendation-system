# Contributing — setup notes

This project includes a small pre-commit hook that warns when migration files that have already been applied to the database were edited locally. It is intended as a developer safeguard; CI also enforces checksum policy and will fail PRs that edit applied migrations.

Quick setup for new developers
1. Clone the repo and install dependencies at the root:

```bash
git clone <repo-url>
cd "fedf project"
npm install
```

2. Install husky git hooks (the `prepare` script runs automatically on `npm install` but run manually if needed):

```bash
# from repo root
npm run prepare
```

What the pre-commit hook does
- The hook runs `node backend/scripts/check_migration_checksums.js` before commit.
- The script compares SHA-256 checksums of SQL files in `backend/migrations/` with the stored checksums in the database `migrations` table.
- If any applied migration file was modified after being applied, the script prints a clear error listing the mismatches and will block the commit. CI will also fail on such mismatches.

Why this matters
- Editing migration files after they have been applied can create inconsistencies between environments and make rollbacks and debugging hard. The pre-commit warning + CI check helps enforce the practice of creating new migrations instead of editing applied ones.

How to run the check manually

```bash
# from repo root
node backend/scripts/check_migration_checksums.js
```

Notes and options
- The pre-commit check requires the database to be reachable (it reads the `migrations` table). If no DB is available locally the check will skip and print a notice.
- If you prefer the hook to block commits, we can change it to exit with non-zero when mismatches are detected — let the team decide.
- CI runs a stricter job: it runs the migration runner against an ephemeral test MySQL instance and will fail the PR if checksums don't match.

If you'd like, I can add a short section here describing how to create a new migration file (naming conventions and examples).
