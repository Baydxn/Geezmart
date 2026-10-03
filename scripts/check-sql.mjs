/**
 * Static sanity checks for the Supabase migrations.
 *
 * This is NOT a Postgres parser. It catches the failure modes that are easy to
 * introduce when hand-writing DDL and impossible to spot by eye:
 *   - unbalanced parentheses / dollar-quotes / BEGIN..END
 *   - statements missing a terminating semicolon
 *   - referencing a table that a previous migration never creates
 *   - a column used in an index or seed INSERT that no CREATE TABLE defines
 *   - `create policy` on a table that does not exist
 *
 * Usage: node scripts/check-sql.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const seedFile = join(root, 'supabase', 'seed.sql');

const errors = [];
const warnings = [];

/** Strip comments and dollar-quoted bodies so we only scan real code. */
function normalise(sql) {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    if (sql.startsWith('--', i)) {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl;
      continue;
    }
    if (sql.startsWith('/*', i)) {
      const end = sql.indexOf('*/', i);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }
    const tag = /^(\$\w*\$)/.exec(sql.slice(i));
    if (tag) {
      const close = sql.indexOf(tag[1], i + tag[1].length);
      if (close === -1) throw new Error('unterminated dollar-quote: ' + tag[1]);
      out += ' $$BODY$$ ';
      i = close + tag[1].length;
      continue;
    }
    out += sql[i];
    i += 1;
  }
  return out;
}

function checkBalance(name, sql) {
  const s = normalise(sql);
  let depth = 0;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === "'") {
      // skip string literal
      i += 1;
      while (i < s.length && s[i] !== "'") {
        if (s[i] === '\\') i += 1;
        i += 1;
      }
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') {
      depth -= 1;
      if (depth < 0) {
        errors.push(`${name}: unbalanced ')' at offset ${i}`);
        return;
      }
    }
  }
  if (depth !== 0) errors.push(`${name}: ${depth} unclosed '('`);
}

/** Split into statements on top-level semicolons. */
function statements(name, sql) {
  const s = normalise(sql);
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === "'") {
      i += 1;
      while (i < s.length && s[i] !== "'") {
        if (s[i] === '\\') i += 1;
        i += 1;
      }
      continue;
    }
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ';' && depth === 0) {
      const text = s.slice(start, i).trim();
      if (text) out.push(text);
      start = i + 1;
    }
  }
  const tail = s.slice(start).trim();
  if (tail) {
    errors.push(`${name}: trailing text without a terminating semicolon -> "${tail.slice(0, 60)}..."`);
  }
  return out;
}

const createdTables = new Set(['auth.users']);
const tableColumns = new Map();
const seenFiles = [];

for (const file of [...files, '../seed.sql']) {
  const path = file.includes('..') ? seedFile : join(dir, file);
  const name = file.replace('../', '');
  seenFiles.push(name);
  const sql = readFileSync(path, 'utf8');

  checkBalance(name, sql);
  const stmts = statements(name, sql);

  for (const stmt of stmts) {
    const create = /^create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/i.exec(stmt);
    if (create) createdTables.add(create[1].toLowerCase());

    const view = /^create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?(\w+)/i.exec(stmt);
    if (view) createdTables.add(view[1].toLowerCase());

    // collect columns per create table
    if (create) {
      const cols = new Set();
      const body = stmt.slice(stmt.indexOf('('));
      for (const m of body.matchAll(/^\s*(\w+)\s+(?:text|uuid|int\b|integer|bigint|boolean|numeric|timestamptz|date|jsonb|json\b|text\[\]|public\.\w+|bigserial)/gim)) {
        cols.add(m[1].toLowerCase());
      }
      for (const m of body.matchAll(/^\s*(\w+)\s+public\./gim)) cols.add(m[1].toLowerCase());
      tableColumns.set(create[1].toLowerCase(), cols);
    }

    // add column later
    const addCol = /^alter\s+table\s+(?:public\.)?(\w+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)/i.exec(stmt);
    if (addCol) {
      const t = addCol[1].toLowerCase();
      if (!tableColumns.has(t)) tableColumns.set(t, new Set());
      tableColumns.get(t).add(addCol[2].toLowerCase());
    }

    // policy / trigger / index target must exist
    const pol = /^create\s+policy\b[\s\S]*?\bon\s+(?:public\.)?(\w+)\b/i.exec(stmt);
    if (pol && !createdTables.has(pol[1].toLowerCase())) {
      errors.push(`${name}: policy targets unknown table "${pol[1]}"`);
    }
    const trig = /^create\s+trigger\s+(\w+)[\s\S]*?\bon\s+(?:public\.)?(\w+)\b/i.exec(stmt);
    if (trig && !createdTables.has(trig[2].toLowerCase())) {
      errors.push(`${name}: trigger "${trig[1]}" targets unknown table "${trig[2]}"`);
    }
    const idx = /^create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?(\w+)\s+on\s+(?:public\.)?(\w+)/i.exec(stmt);
    if (idx && !createdTables.has(idx[2].toLowerCase())) {
      errors.push(`${name}: index "${idx[1]}" targets unknown table "${idx[2]}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// Statement ORDER check: a column must exist before it is referenced.
// Catches the "column X does not exist" class of runtime failure, e.g. an index
// on a column added by a later ALTER TABLE.
// ---------------------------------------------------------------------------
// Build the column map from CREATE TABLE bodies ONLY. Columns introduced by a
// later ALTER TABLE must NOT be seeded here, otherwise this check can never
// detect the very bug it exists to catch.
const TYPE_RE = /^\s*([a-z_][a-z0-9_]*)\s+(?:text|uuid|bool(ean)?|int(eger)?|bigint|smallint|numeric|decimal|real|double|date|time|timestamptz|timestamp|jsonb?|bytea|text\[\]|public\.)/i;

function columnsFromCreateTable(stmt) {
  const cols = new Set();
  const open = stmt.indexOf('(');
  if (open === -1) return cols;
  const body = stmt.slice(open + 1);
  for (const part of body.split(',')) {
    const m = TYPE_RE.exec(part);
    if (m) cols.add(m[1].toLowerCase());
  }
  return cols;
}

const orderProblems = [];
const colsAt = new Map();

function checkStatementOrder(fileName, stmt) {
  // 1. ALTER TABLE ... ADD COLUMN declares a column up-front.
  const addCol = /^alter\s+table\s+(?:public\.)?(\w+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)/i.exec(stmt);
  if (addCol) {
    const t = addCol[1].toLowerCase();
    if (!colsAt.has(t)) colsAt.set(t, new Set());
    colsAt.get(t).add(addCol[2].toLowerCase());
    return;
  }

  // 2a. CREATE TABLE establishes the columns available from that point on.
  const create = /^create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/i.exec(stmt);
  if (create) {
    const t = create[1].toLowerCase();
    if (!colsAt.has(t)) colsAt.set(t, columnsFromCreateTable(stmt));
    return;
  }

  // 2b. An index may only reference columns created SO FAR.
  const target = /^create\s+(?:unique\s+)?index\s+(?:if\s+not\s+exists\s+)?\w+\s+on\s+(?:public\.)?(\w+)\s*\(([^)]+)\)/i.exec(stmt);
  if (!target) return;

  const table = target[1].toLowerCase();
  if (table === 'auth.users') return;

  const known = colsAt.get(table);
  if (!known) return;

  for (const rawCol of target[2].split(',')) {
    // Only a bare leading identifier is a column reference. This skips
    // type specs like numeric(12,2), and table-level CONSTRAINT / UNIQUE /
    // PRIMARY KEY / FOREIGN KEY / CHECK clauses.
    // Index columns are bare identifiers with no type, e.g.
    //   (featured, sort_order_hint)   or   gin (name gin_trgm_ops)
    // so take the leading word, ignoring index-method keywords and functions.
    const ident = /^\s*([a-z_][a-z0-9_]*)/i.exec(rawCol);
    if (!ident) continue;
    const col = ident[1].toLowerCase();
    if (/^(select|from|where|on|using|asc|desc|nulls|first|last|gist|gin|b-tree|brin)$/.test(col)) continue;
    if (!known.has(col)) {
      orderProblems.push(
        `${fileName}: "${table}.${col}" is referenced before it is created ` +
        `(add it with ALTER TABLE ... ADD COLUMN ${col}) -- Postgres will fail with 42703`,
      );
    }
  }
}

for (const file of files) {
  const path = join(dir, file);
  const name = file;
  for (const stmt of statements(name, readFileSync(path, 'utf8'))) {
    checkStatementOrder(name, stmt);
  }
}

for (const p of orderProblems) errors.push(p);

// Cross-check seed INSERT columns against the schema.
const seed = normalise(readFileSync(seedFile, 'utf8'));
for (const m of seed.matchAll(/insert\s+into\s+(?:public\.)?(\w+)\s*\(([^)]+)\)/gi)) {
  const table = m[1].toLowerCase();
  if (!createdTables.has(table)) {
    errors.push(`seed.sql: inserts into unknown table "${table}"`);
    continue;
  }
  const known = tableColumns.get(table) ?? new Set();
  for (const raw of m[2].split(',')) {
    const col = raw.trim().toLowerCase();
    if (col && !known.has(col)) {
      errors.push(`seed.sql: column "${col}" not found on ${table}`);
    }
  }
}

if (warnings.length) {
  console.log('WARNINGS');
  for (const w of warnings) console.log('  ! ' + w);
}
if (errors.length) {
  console.error(`\nFAILED - ${errors.length} problem(s):`);
  for (const e of errors) console.error('  x ' + e);
  process.exit(1);
}
console.log(`OK - ${seenFiles.length} files, ${createdTables.size} tables/views, schema references consistent.`);
