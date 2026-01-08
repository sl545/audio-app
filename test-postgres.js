require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testPostgres() {
  console.log('🔍 测试 PostgreSQL 连接...\n');

  try {
    // 测试 1: 连接数据库
    const client = await pool.connect();
    console.log('✅ 数据库连接成功\n');

    // 测试 2: 查看数据库信息
    const versionResult = await client.query('SELECT version()');
    console.log('📋 数据库版本:');
    console.log('   ' + versionResult.rows[0].version.split(',')[0]);
    console.log('');

    // 测试 3: 查看现有表
    const tablesResult = await client.query(`
      SELECT 
        table_name,
        pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📋 现有数据表:');
    if (tablesResult.rows.length === 0) {
      console.log('   (数据库为空，还没有表)');
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name.padEnd(30)} (${row.size})`);
      });
    }
    console.log('');

    // 测试 4: 如果有表，查看每个表的列
    if (tablesResult.rows.length > 0) {
      console.log('📋 表结构详情:\n');
      
      for (const table of tablesResult.rows) {
        const columnsResult = await client.query(`
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_name = $1
          ORDER BY ordinal_position
        `, [table.table_name]);

        console.log(`   表: ${table.table_name}`);
        columnsResult.rows.forEach(col => {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const def = col.column_default ? ` DEFAULT ${col.column_default}` : '';
          console.log(`     - ${col.column_name}: ${col.data_type} ${nullable}${def}`);
        });
        console.log('');
      }
    }

    // 测试 5: 统计信息
    if (tablesResult.rows.length > 0) {
      console.log('📊 数据统计:\n');
      
      for (const table of tablesResult.rows) {
        const countResult = await client.query(`
          SELECT COUNT(*) as count FROM ${table.table_name}
        `);
        console.log(`   ${table.table_name}: ${countResult.rows[0].count} 行`);
      }
      console.log('');
    }

    client.release();
    await pool.end();

    console.log('🎉 PostgreSQL 测试通过！\n');

    // 给出建议
    if (tablesResult.rows.length === 0) {
      console.log('💡 下一步:');
      console.log('   数据库为空，需要创建表结构');
      console.log('   我会提供创建表的 SQL 脚本');
    } else {
      console.log('💡 下一步:');
      console.log('   检查是否需要添加 R2 相关字段');
      console.log('   (storage_url, storage_key, mime_type)');
    }

  } catch (error) {
    console.error('❌ 数据库连接失败:');
    console.error('错误信息:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 建议: 数据库连接被拒绝');
      console.error('   - 检查 DATABASE_URL 是否正确');
      console.error('   - 确认 Railway 数据库是否正在运行');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\n💡 建议: 找不到数据库主机');
      console.error('   - 检查 DATABASE_URL 中的主机名');
    } else if (error.message.includes('password')) {
      console.error('\n💡 建议: 密码认证失败');
      console.error('   - 检查 DATABASE_URL 中的密码');
    }

    await pool.end();
  }
}

testPostgres();