#!/usr/bin/env node
/**
 * Builds DATABASE_URL for Docker (host=postgres) with URL-encoded credentials.
 */
const user = process.env.POSTGRES_USER || 'postgres';
const password = process.env.POSTGRES_PASSWORD || '';
const db = process.env.POSTGRES_DB || 'xander_ai_ide';
const host = process.env.POSTGRES_HOST || 'postgres';
const port = process.env.POSTGRES_PORT || '5432';

if (!password) {
  console.error('ERROR: POSTGRES_PASSWORD is empty');
  process.exit(1);
}

const enc = (s) => encodeURIComponent(s);
process.stdout.write(
  `postgresql://${enc(user)}:${enc(password)}@${host}:${port}/${db}`,
);
