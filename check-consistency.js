require('dotenv').config();
const { Pool } = require('pg');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function checkConsistency() {
  try {
    console.log('========================================');
    console.log('检查 R2 和数据库一致性');
    console.log('========================================\n');

    // 1. 获取 R2 中的所有文件
    console.log('📦 正在获取 R2 中的文件...\n');
    
    const r2Files = [];
    let continuationToken = undefined;
    
    do {
      const command = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        ContinuationToken: continuationToken,
      });
      
      const response = await s3Client.send(command);
      
      if (response.Contents) {
        r2Files.push(...response.Contents);
      }
      
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    console.log(`R2 中共有 ${r2Files.length} 个文件:\n`);
    
    r2Files.forEach((file, index) => {
      console.log(`${index + 1}. ${file.Key} (${file.Size} bytes)`);
    });
    console.log('');

    // 2. 获取数据库中的所有文件
    console.log('🗄️  正在获取数据库中的记录...\n');
    
    const dbFiles = await pool.query('SELECT id, filename, url, size FROM files ORDER BY id');
    
    console.log(`数据库中共有 ${dbFiles.rows.length} 条记录:\n`);
    
    dbFiles.rows.forEach((file, index) => {
      console.log(`${index + 1}. ID: ${file.id}, ${file.filename}`);
      console.log(`   URL: ${file.url}`);
      console.log(`   Size: ${file.size}\n`);
    });

    // 3. 分析差异
    console.log('========================================');
    console.log('📊 一致性分析');
    console.log('========================================\n');

    // 找出损坏的 URL
    const brokenUrls = dbFiles.rows.filter(f => f.url.startsWith('undefined/'));
    console.log(`❌ 损坏的 URL: ${brokenUrls.length} 个`);
    if (brokenUrls.length > 0) {
      brokenUrls.forEach(f => {
        console.log(`   - ID ${f.id}: ${f.filename}`);
      });
    }
    console.log('');

    // 找出在数据库但不在 R2 的
    const dbNotInR2 = [];
    dbFiles.rows.forEach(dbFile => {
      if (dbFile.url.startsWith('undefined/')) {
        // 跳过损坏的 URL
        return;
      }
      
      // 从 URL 提取 key
      let key;
      if (dbFile.url.includes('.com/')) {
        key = dbFile.url.split('.com/')[1];
      } else if (dbFile.url.startsWith('uploads/')) {
        key = dbFile.url;
      } else {
        key = null;
      }
      
      if (key) {
        const found = r2Files.find(r2File => r2File.Key === key);
        if (!found) {
          dbNotInR2.push({ ...dbFile, extractedKey: key });
        }
      }
    });

    console.log(`⚠️  在数据库但不在 R2: ${dbNotInR2.length} 个`);
    if (dbNotInR2.length > 0) {
      dbNotInR2.forEach(f => {
        console.log(`   - ID ${f.id}: ${f.filename}`);
        console.log(`     Key: ${f.extractedKey}`);
      });
    }
    console.log('');

    // 找出在 R2 但不在数据库的
    const r2NotInDb = [];
    r2Files.forEach(r2File => {
      const found = dbFiles.rows.find(dbFile => {
        if (dbFile.url.includes(r2File.Key)) {
          return true;
        }
        return false;
      });
      
      if (!found) {
        r2NotInDb.push(r2File);
      }
    });

    console.log(`🗑️  在 R2 但不在数据库: ${r2NotInDb.length} 个（孤儿文件）`);
    if (r2NotInDb.length > 0) {
      r2NotInDb.forEach(f => {
        console.log(`   - ${f.Key} (${f.Size} bytes)`);
      });
    }
    console.log('');

    console.log('========================================');
    console.log('✅ 检查完成！');
    console.log('========================================');

    await pool.end();

  } catch (err) {
    console.error('❌ 错误:', err);
    await pool.end();
  }
}

checkConsistency();