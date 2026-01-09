// fix-db.js
// 修复数据库：让 email 字段允许为空

require('dotenv').config();
const { Pool } = require('pg');

async function fixDatabase() {
  const db = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    console.log('🔧 正在修复数据库...');
    
    // 让 email 字段允许为空
    await db.query('ALTER TABLE users ALTER COLUMN email DROP NOT NULL;');
    
    console.log('✅ 数据库修复成功！email 字段现在允许为空');
    
    // 验证修改
    const result = await db.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'email';
    `);
    
    console.log('📊 验证结果:', result.rows);
    
  } catch (err) {
    console.error('❌ 修复失败:', err.message);
    console.error(err);
  } finally {
    await db.end();
    console.log('🔌 数据库连接已关闭');
  }
}

fixDatabase();