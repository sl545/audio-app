require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkDatabase() {
  try {
    console.log('========================================');
    console.log('Checking database structure...');
    console.log('========================================\n');

    // 1. Check if users table exists
    console.log('1. Checking users table...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Users table does NOT exist!');
      console.log('\nYou need to create it. Run this SQL:');
      console.log(`
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
      `);
      await pool.end();
      return;
    }
    
    console.log('✅ Users table exists');

    // 2. Check table structure
    console.log('\n2. Checking table structure...');
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);

    console.log('\nColumns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(required)' : '(optional)'}`);
    });

    // 3. Check if there are any users
    console.log('\n3. Checking users...');
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`   Total users: ${userCount.rows[0].count}`);

    if (userCount.rows[0].count === '0') {
      console.log('\n❌ No users found!');
      console.log('\nYou need to create a test user. Options:');
      console.log('  a) Register through the app');
      console.log('  b) Run this SQL:');
      console.log(`
-- Password is: 123456
INSERT INTO users (username, password, email, role) VALUES 
('testuser', '$2b$10$YourHashedPasswordHere', 'test@example.com', 'user');
      `);
    } else {
      console.log('✅ Users exist');
      
      // Show users (without passwords)
      const users = await pool.query('SELECT id, username, email, role, created_at FROM users LIMIT 5');
      console.log('\nFirst 5 users:');
      users.rows.forEach(user => {
        console.log(`  - ID: ${user.id}, Username: ${user.username}, Role: ${user.role}`);
      });
    }

    // 4. Check files table
    console.log('\n4. Checking files table...');
    const filesTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'files'
      );
    `);

    if (!filesTableCheck.rows[0].exists) {
      console.log('❌ Files table does NOT exist!');
      console.log('\nYou need to create it. Run this SQL:');
      console.log(`
CREATE TABLE files (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  size INTEGER,
  mimetype VARCHAR(100),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
      `);
    } else {
      console.log('✅ Files table exists');
      
      const fileCount = await pool.query('SELECT COUNT(*) FROM files');
      console.log(`   Total files: ${fileCount.rows[0].count}`);
    }

    console.log('\n========================================');
    console.log('Check complete!');
    console.log('========================================');

    await pool.end();

  } catch (err) {
    console.error('\n❌ Error during check:', err.message);
    console.error('\nFull error:', err);
    await pool.end();
  }
}

checkDatabase();