require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const CORRECT_URL = process.env.R2_PUBLIC_URL;

async function fixOldR2Urls() {
  try {
    console.log('========================================');
    console.log('修复旧的 R2.dev URL');
    console.log('========================================\n');
    console.log('正确的 R2_PUBLIC_URL:', CORRECT_URL);
    console.log('');

    // 查找使用旧 r2.dev URL 的文件
    const oldUrls = await pool.query(`
      SELECT id, filename, url 
      FROM files 
      WHERE url LIKE 'https://pub-%.r2.dev/%'
      ORDER BY id
    `);

    console.log(`找到 ${oldUrls.rows.length} 个使用旧 URL 的文件:\n`);

    if (oldUrls.rows.length === 0) {
      console.log('✅ 没有需要修复的旧 URL！');
      await pool.end();
      return;
    }

    // 显示并修复
    let fixed = 0;
    for (const file of oldUrls.rows) {
      console.log(`修复 ID ${file.id}: ${file.filename}`);
      console.log(`  旧 URL: ${file.url}`);
      
      // 提取路径部分
      const pathMatch = file.url.match(/r2\.dev\/(.+)$/);
      if (pathMatch) {
        const path = pathMatch[1];
        const newUrl = `${CORRECT_URL}/${path}`;
        
        console.log(`  新 URL: ${newUrl}\n`);
        
        await pool.query(
          'UPDATE files SET url = $1 WHERE id = $2',
          [newUrl, file.id]
        );
        
        fixed++;
      } else {
        console.log(`  ⚠️  无法提取路径，跳过\n`);
      }
    }

    console.log(`========================================`);
    console.log(`✅ 成功修复 ${fixed} 个文件！`);
    console.log(`========================================`);

    await pool.end();

  } catch (err) {
    console.error('❌ 错误:', err);
    await pool.end();
  }
}

fixOldR2Urls();