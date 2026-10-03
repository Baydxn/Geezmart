/**
 * Concatenates supabase/migrations/*.sql + supabase/seed.sql into
 * supabase/COMPLETE_SCHEMA.sql -- a single paste-ready script for the
 * Supabase SQL Editor.
 *
 * Run after changing any migration:  npm run db:bundle
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const HEADER = `-- ============================================================================
--  GEEZMART -- COMPLETE DATABASE SCHEMA (single file, paste-ready)
--  Generated from supabase/migrations/*.sql -- edit those, not this file.
--
--  HOW TO APPLY (Supabase dashboard):
--    1. Go to  SQL Editor  ->  New query
--    2. Paste this ENTIRE file
--    3. Click Run
--
--  Safe to run more than once: every object uses IF NOT EXISTS / OR REPLACE.
--  Sections, in order:
--    1. Extensions, enums, shared helpers
--    2. Catalogue + inventory
--    3. Customers, carts, abandoned checkouts
--    4. Orders, payments, shipping, coupons
--    5. Storefront content, reviews, notifications
--    6. Roles + row level security
--    7. Transactional RPCs
--    8. Seed data
-- ============================================================================
`;

const strip = (s) => s.replace(/^\uFEFF/, '');
let out = HEADER + '\n';

for (const file of files) {
  out += `\n\n-- ############################################################################\n`;
  out += `-- ### FILE: supabase/migrations/${file}\n`;
  out += `-- ############################################################################\n\n`;
  out += strip(readFileSync(join(dir, file), 'utf8')) + '\n';
}

out += `\n\n-- ############################################################################\n`;
out += `-- ### FILE: supabase/seed.sql\n`;
out += `-- ############################################################################\n\n`;
out += strip(readFileSync(join(root, 'supabase', 'seed.sql'), 'utf8')) + '\n';

const target = join(root, 'supabase', 'COMPLETE_SCHEMA.sql');
writeFileSync(target, out);
console.log(`Wrote supabase/COMPLETE_SCHEMA.sql (${files.length + 1} sources, ${out.split('\n').length} lines).`);
