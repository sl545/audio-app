require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function viewDatabase() {
  try {
    console.log('========================================');
    console.log('📊 完整数据库查看');
    console.log('========================================\n');

    // 1. 用户表
    console.log('👥 USERS 表');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const users = await pool.query(`
      SELECT id, username, email, role, created_at, updated_at 
      FROM users 
      ORDER BY id
    `);
    
    console.log(`总共 ${users.rows.length} 个用户:\n`);
    
    users.rows.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   用户名: ${user.username}`);
      console.log(`   邮箱: ${user.email || '未设置'}`);
      console.log(`   角色: ${user.role}`);
      console.log(`   创建时间: ${user.created_at}`);
      if (user.updated_at) {
        console.log(`   更新时间: ${user.updated_at}`);
      }
      console.log('');
    });

    // 2. 文件表
    console.log('\n📁 FILES 表');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const files = await pool.query(`
      SELECT 
        f.id, 
        f.filename, 
        f.url, 
        f.size, 
        f.mimetype, 
        f.user_id,
        u.username as owner,
        f.created_at,
        f.updated_at
      FROM files f
      LEFT JOIN users u ON f.user_id = u.id
      ORDER BY f.id
    `);
    
    console.log(`总共 ${files.rows.length} 个文件:\n`);
    
    files.rows.forEach((file, index) => {
      console.log(`${index + 1}. ID: ${file.id}`);
      console.log(`   文件名: ${file.filename}`);
      console.log(`   大小: ${formatSize(file.size)}`);
      console.log(`   类型: ${file.mimetype || '未知'}`);
      console.log(`   所有者: ${file.owner} (ID: ${file.user_id})`);
      console.log(`   URL: ${file.url.substring(0, 80)}${file.url.length > 80 ? '...' : ''}`);
      console.log(`   创建时间: ${file.created_at}`);
      console.log('');
    });

    // 3. 统计信息
    console.log('\n📈 统计信息');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // 每个用户的文件数
    const userStats = await pool.query(`
      SELECT 
        u.username,
        COUNT(f.id) as file_count,
        SUM(f.size) as total_size
      FROM users u
      LEFT JOIN files f ON u.id = f.user_id
      GROUP BY u.id, u.username
      ORDER BY file_count DESC
    `);
    
    console.log('用户文件统计:\n');
    userStats.rows.forEach((stat, index) => {
      console.log(`${index + 1}. ${stat.username}`);
      console.log(`   文件数: ${stat.file_count || 0}`);
      console.log(`   总大小: ${formatSize(stat.total_size || 0)}`);
      console.log('');
    });

    // 文件类型统计
    const typeStats = await pool.query(`
      SELECT 
        mimetype,
        COUNT(*) as count,
        SUM(size) as total_size
      FROM files
      GROUP BY mimetype
      ORDER BY count DESC
    `);
    
    console.log('文件类型统计:\n');
    typeStats.rows.forEach((stat, index) => {
      console.log(`${index + 1}. ${stat.mimetype || '未知'}`);
      console.log(`   数量: ${stat.count}`);
      console.log(`   总大小: ${formatSize(stat.total_size || 0)}`);
      console.log('');
    });

    // 总体统计
    const totalStats = await pool.query(`
      SELECT 
        COUNT(*) as total_files,
        SUM(size) as total_size,
        AVG(size) as avg_size,
        MAX(size) as max_size,
        MIN(size) as min_size
      FROM files
    `);
    
    const stats = totalStats.rows[0];
    console.log('总体统计:\n');
    console.log(`   总文件数: ${stats.total_files}`);
    console.log(`   总大小: ${formatSize(stats.total_size || 0)}`);
    console.log(`   平均大小: ${formatSize(stats.avg_size || 0)}`);
    console.log(`   最大文件: ${formatSize(stats.max_size || 0)}`);
    console.log(`   最小文件: ${formatSize(stats.min_size || 0)}`);

    // 4. 数据质量检查
    console.log('\n\n🔍 数据质量检查');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const brokenUrls = await pool.query(`
      SELECT COUNT(*) as count FROM files WHERE url LIKE 'undefined/%'
    `);
    console.log(`损坏的 URL: ${brokenUrls.rows[0].count}`);
    
    const orphanFiles = await pool.query(`
      SELECT COUNT(*) as count FROM files WHERE user_id NOT IN (SELECT id FROM users)
    `);
    console.log(`孤儿文件（用户已删除）: ${orphanFiles.rows[0].count}`);
    
    const nullSizes = await pool.query(`
      SELECT COUNT(*) as count FROM files WHERE size IS NULL
    `);
    console.log(`缺少大小信息: ${nullSizes.rows[0].count}`);

    console.log('\n========================================');
    console.log('✅ 查看完成！');
    console.log('========================================');

    await pool.end();

  } catch (err) {
    console.error('❌ 错误:', err);
    await pool.end();
  }
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(2)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

viewDatabase();