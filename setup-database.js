require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function setupDatabase() {
  console.log('🔧 开始创建数据库表结构...\n');

  const client = await pool.connect();

  try {
    // 开启事务
    await client.query('BEGIN');

    // 1. 创建 users 表
    console.log('📋 创建 users 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ users 表创建成功\n');

    // 2. 创建 audio_files 表
    console.log('📋 创建 audio_files 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS audio_files (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_size BIGINT NOT NULL,
        duration FLOAT,
        mime_type VARCHAR(50),
        storage_url TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        waveform_data JSONB,
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ audio_files 表创建成功\n');

    // 3. 创建 audio_analysis 表（未来用于存储 MFCC、分类结果）
    console.log('📋 创建 audio_analysis 表...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS audio_analysis (
        id SERIAL PRIMARY KEY,
        file_id INTEGER NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
        mfcc_features JSONB,
        classification VARCHAR(100),
        confidence FLOAT,
        spectral_centroid FLOAT,
        tempo FLOAT,
        dynamic_range FLOAT,
        metadata JSONB,
        analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ audio_analysis 表创建成功\n');

    // 4. 创建索引
    console.log('📋 创建索引...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audio_files_user_id 
      ON audio_files(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audio_files_created_at 
      ON audio_files(created_at)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audio_analysis_file_id 
      ON audio_analysis(file_id)
    `);
    console.log('   ✅ 索引创建成功\n');

    // 5. 创建更新时间触发器函数
    console.log('📋 创建触发器函数...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    console.log('   ✅ 触发器函数创建成功\n');

    // 6. 为 users 表创建触发器
    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users
    `);
    await client.query(`
      CREATE TRIGGER update_users_updated_at 
      BEFORE UPDATE ON users
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column()
    `);

    // 7. 为 audio_files 表创建触发器
    await client.query(`
      DROP TRIGGER IF EXISTS update_audio_files_updated_at ON audio_files
    `);
    await client.query(`
      CREATE TRIGGER update_audio_files_updated_at 
      BEFORE UPDATE ON audio_files
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column()
    `);
    console.log('   ✅ 触发器创建成功\n');

    // 8. 插入测试管理员用户（密码：admin123）
    console.log('📋 创建测试管理员账户...');
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    await client.query(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO NOTHING
    `, ['admin', 'admin@example.com', hashedPassword, 'admin']);
    console.log('   ✅ 测试账户创建成功');
    console.log('   👤 用户名: admin');
    console.log('   🔑 密码: admin123\n');

    // 提交事务
    await client.query('COMMIT');

    console.log('🎉 数据库设置完成！\n');

    // 显示表结构
    const tables = await client.query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📊 数据库结构摘要:');
    tables.rows.forEach(table => {
      console.log(`   ✅ ${table.table_name} (${table.column_count} 列)`);
    });

    console.log('\n✨ 数据库已准备就绪，可以开始开发了！');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ 数据库设置失败:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// 运行设置
setupDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});