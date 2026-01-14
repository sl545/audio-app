require('dotenv').config();
const { Pool } = require('pg');

console.log('Testing database connection...');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Found' : 'Missing');

// 方法 1: 自动检测 SSL
const pool1 = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// 方法 2: 强制使用 SSL
const pool2 = new Pool({
  connectionString: process.env.DATABASE_URL + '?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function test() {
  console.log('\n--- Method 1: Basic SSL ---');
  try {
    const result = await pool1.query('SELECT NOW()');
    console.log('✅ Connection successful!');
    console.log('   Server time:', result.rows[0].now);
    await pool1.end();
  } catch (err) {
    console.log('❌ Connection failed!');
    console.log('   Error:', err.message);
  }

  console.log('\n--- Method 2: Force SSL ---');
  try {
    const result = await pool2.query('SELECT NOW()');
    console.log('✅ Connection successful!');
    console.log('   Server time:', result.rows[0].now);
    await pool2.end();
  } catch (err) {
    console.log('❌ Connection failed!');
    console.log('   Error:', err.message);
  }

  process.exit(0);
}

test();