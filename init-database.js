// init-database.js
// 初始化数据库表结构

require('dotenv').config();
const { Pool } = require('pg');

async function initDatabase() {
  const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 初始化数据库');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 1. 检查 users 表是否存在
    console.log('\n📋 检查 users 表...');
    const usersExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      );
    `);
    
    if (usersExists.rows[0].exists) {
      console.log('✅ users 表已存在');
    } else {
      console.log('⚠️  users 表不存在，需要先创建 users 表');
    }
    
    // 2. 创建 files 表
    console.log('\n📋 创建 files 表...');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS files (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        mimetype VARCHAR(100),
        size INTEGER,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✅ files 表创建成功');
    
    // 3. 创建索引
    console.log('\n📋 创建索引...');
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_files_user_id 
      ON files(user_id);
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_files_created_at 
      ON files(created_at DESC);
    `);
    
    console.log('✅ 索引创建成功');
    
    // 4. 验证表结构
    console.log('\n📊 验证表结构...');
    
    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'files'
      ORDER BY ordinal_position;
    `);
    
    console.log('\nfiles 表的字段:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(必填)' : '(可选)'}`);
    });
    
    // 5. 检查现有数据
    const count = await db.query('SELECT COUNT(*) FROM files');
    console.log(`\n📈 当前文件数: ${count.rows[0].count}`);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 数据库初始化完成！');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.error('\n❌ 初始化失败:', error.message);
    console.error(error);
  } finally {
    await db.end();
  }
}

initDatabase();