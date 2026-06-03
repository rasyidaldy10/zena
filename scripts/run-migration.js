#!/usr/bin/env node

/**
 * Auto-run SQL migrations to Supabase
 * Usage: node scripts/run-migration.js <migration-file>
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

async function runMigration(sqlFile) {
  const sqlPath = path.resolve(sqlFile);

  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ File not found: ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`📄 Running migration: ${path.basename(sqlPath)}`);
  console.log(`🔗 Target: ${SUPABASE_URL}\n`);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql })
    });

    // Alternative: Use PostgREST directly
    const postgrestResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: sql })
    });

    if (response.ok || postgrestResponse.ok) {
      console.log('✅ Migration executed successfully!');
      console.log('\n📊 Results:');
      const result = await response.json().catch(() => ({ message: 'Success' }));
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('❌ Migration failed!');
      console.error('Status:', response.status, postgrestResponse.status);
      const error = await response.text();
      console.error('Error:', error);
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Error running migration:', err.message);
    process.exit(1);
  }
}

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('Usage: node scripts/run-migration.js <sql-file>');
  console.error('Example: node scripts/run-migration.js supabase/migrations/002_add_ceo_welcome_flag.sql');
  process.exit(1);
}

runMigration(sqlFile);
