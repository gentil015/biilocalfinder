-- Case-insensitive email uniqueness.
--
-- The app normalises emails to lowercase in RegisterDto/LoginDto, but that is
-- only an application-level convention: any other write path (seed script,
-- admin tooling, raw SQL, a future service) could still store a mixed-case
-- duplicate, and `users_email_key` is a plain B-tree on TEXT so it would
-- happily accept it. This index makes the database itself reject the write.
--
-- Deliberately ADDITIVE: `users_email_key` is left in place because Prisma's
-- `findUnique({ where: { email } })` (used by AuthService.login) resolves
-- against that named constraint. Dropping it in favour of a functional index
-- makes Prisma fail with "could not find unique constraint". The functional
-- index below is an extra invariant layered on top, not a replacement.

-- 1. Backfill first: creating the index below fails if any two existing rows
--    differ only by case, so normalise before we ask the DB to enforce it.
--    The guard deliberately ABORTS rather than deleting a row. Silently
--    dropping one of two accounts for the same mailbox would destroy real
--    data (bookings, messages, payouts) with no way back -- resolve these by
--    hand, then re-run.
DO $$
DECLARE
  dupes TEXT;
BEGIN
  SELECT string_agg(email, ', ' ORDER BY email)
  INTO dupes
  FROM (
    SELECT lower(email) AS email FROM users GROUP BY lower(email) HAVING count(*) > 1
  ) d;

  IF dupes IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot enforce case-insensitive email uniqueness: these addresses exist more than once, differing only by case: %', dupes;
  END IF;
END $$;

UPDATE users SET email = lower(btrim(email)) WHERE email <> lower(btrim(email));

-- 2. The actual guard. ADDITIVE -- users_email_key stays (see header).
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_key" ON "users" (lower("email"));
