# Migrations

This folder contains SQL migrations that modify the application's MySQL schema. The project uses a small migration runner (`backend/scripts/run_migrations.js`) that records applied migrations and verifies file integrity.

Key points
- Each migration is a single `.sql` file. Files are applied in lexical order (e.g. `001_create_foo.sql`, `002_alter_bar.sql`).
- The runner creates and maintains a `migrations` table with columns: `id`, `name`, `checksum`, `applied_at`.
- A SHA-256 checksum of the migration file is computed and stored when the migration is applied.

Checksum policy (important)
- Once a migration file has been applied and its checksum recorded in the `migrations` table, the runner will refuse to re-apply if the file content has changed. This prevents accidental edits to already-applied migrations.
- If you need to change schema after a migration was applied, DO NOT edit the existing migration file. Instead, create a new migration file (with a new incremental prefix) that performs the necessary changes.

Workflow — adding a migration
1. Create a new SQL file in this folder with a leading index and descriptive name, e.g. `003_add_favorite_notes.sql`.
2. Put the required SQL statements in the file. Prefer transactional statements (InnoDB) when possible.
3. Run migrations locally to apply them (and verify):

```bash
cd backend
# run runner (idempotent)
npm run migrate
```

What happens on `npm run migrate`
- The runner ensures the `migrations` table exists.
- It skips files already recorded (and verifies their checksums). If a recorded migration file's checksum differs from the file on disk, the runner fails with an explanatory error.
- New migrations are applied inside a transaction; the filename and checksum are recorded on success.

CI behavior
- The repository includes a GitHub Actions job that runs the migration runner against an ephemeral MySQL instance. If an applied migration file has been edited in a PR, CI will fail. This catches accidental edits to applied migrations early.

Advanced notes & troubleshooting
- Backfilling: When adding checksum support to an existing project, the runner will backfill checksum values for previously-applied migrations when possible.
- Rolling back: This runner does not provide automatic rollbacks. If you need reversible migrations, include explicit `DOWN` statements (or use a tooling strategy that supports rollbacks).
- DDL auto-commit: Some DDL statements may force an implicit commit on MySQL; the runner executes whole `.sql` content and records success only if it succeeds.

Best practices
- Use small, focused migrations. Prefer adding new migrations for changes instead of editing applied migrations.
- Review migration SQL in PRs carefully — CI enforces checksum stability for applied migrations.
- Use a dedicated test database in CI or locally when testing migrations.

If you want a helper or a `--repair` mode (to overwrite recorded checksums in exceptional cases), ask and I can add a guarded, authenticated command that only maintainers can run.
