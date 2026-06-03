#!/usr/bin/env node

/**
 * Run SQL directly to Supabase using service role
 * Uses Supabase Management API or direct PostgreSQL connection
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

async function runSQL(sqlFile) {
  const sqlPath = path.resolve(sqlFile);

  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ File not found: ${sqlPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log(`📄 SQL File: ${path.basename(sqlPath)}`);
  console.log(`🔗 Target: ${SUPABASE_URL}`);
  console.log(`\n📝 SQL Content:\n${sql}\n`);
  console.log('─'.repeat(60));

  // Extract project ref from URL
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

  if (!projectRef) {
    console.error('❌ Could not extract project ref from URL');
    process.exit(1);
  }

  console.log(`\n🚀 Executing via Supabase API...`);

  try {
    // Use Supabase SQL Editor API endpoint
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('\n✅ SQL executed successfully!');
      console.log('\n📊 Result:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error('\n❌ SQL execution failed!');
      console.error('Status:', response.status, response.statusText);
      const error = await response.text();
      console.error('Error:', error);

      console.log('\n\n📋 MANUAL FALLBACK:');
      console.log('Copy this SQL and run it in Supabase SQL Editor:');
      console.log('─'.repeat(60));
      console.log(sql);
      console.log('─'.repeat(60));
      console.log('\n🔗 Open SQL Editor:');
      console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`);

      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ Error:', err.message);

    console.log('\n\n📋 MANUAL FALLBACK:');
    console.log('Copy this SQL and run it in Supabase SQL Editor:');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
    console.log('\n🔗 Open SQL Editor:');
    console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`);

    process.exit(1);
  }
}

const sqlFile = process.argv[2] || 'supabase/migrations/002_add_ceo_welcome_flag.sql';
runSQL(sqlFile);
