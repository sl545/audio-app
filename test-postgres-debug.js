require('dotenv').config();
const { Pool } = require('pg');

console.log('📋 检查配置...\n');

// 显示 DATABASE_URL 格式（隐藏密码）
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  const urlParts = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (urlParts) {
    console.log('   用户名:', urlParts[1]);
    console.log('   密码: ****');
    console.log('   主机:', urlParts[3]);
    console.log('   端口:', urlParts[4]);
    console.log('   数据库:', urlParts[5]);
  } else {
    console.log('   DATABASE_URL:', dbUrl);
  }
} else {
  console.log('   ❌ DATABASE_URL 未设置');
}
console.log('');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // 增加超时时间
  connectionTimeoutMillis: 10000,
});

async function testPostgres() {
  console.log('🔍 尝试连接 PostgreSQL...\n');

  try {
    const client = await pool.connect();
    console.log('✅ 数据库连接成功！\n');

    // 基本查询测试
    const result = await client.query('SELECT NOW() as current_time');
    console.log('📅 服务器时间:', result.rows[0].current_time);

    // 查看表
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    console.log('\n📋 现有表:');
    if (tables.rows.length === 0) {
      console.log('   (数据库为空)');
    } else {
      tables.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    }

    client.release();
    await pool.end();

    console.log('\n🎉 测试通过！');

  } catch (error) {
    console.error('❌ 连接失败\n');
    console.error('错误类型:', error.constructor.name);
    console.error('错误代码:', error.code || '无');
    console.error('错误信息:', error.message);
    console.error('\n完整错误:');
    console.error(error);

    console.log('\n🔧 可能的原因:\n');

    if (error.code === 'ECONNREFUSED') {
      console.log('   1. Railway 数据库可能已停止或删除');
      console.log('   2. 网络连接问题');
      console.log('   3. 防火墙阻止连接');
    } else if (error.code === 'ENOTFOUND') {
      console.log('   1. 主机名错误');
      console.log('   2. Railway 数据库 URL 已过期');
      console.log('   3. DNS 解析问题');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      console.log('   1. 网络超时');
      console.log('   2. Railway 数据库不可访问');
      console.log('   3. 需要检查 Railway 项目状态');
    } else if (error.message.includes('password')) {
      console.log('   1. 密码错误');
      console.log('   2. DATABASE_URL 格式不正确');
    } else if (error.message.includes('no pg_hba.conf')) {
      console.log('   1. SSL 配置问题');
      console.log('   2. 尝试修改 SSL 设置');
    } else {
      console.log('   未知错误，请检查上面的完整错误信息');
    }

    console.log('\n💡 建议:\n');
    console.log('   1. 登录 Railway Dashboard 检查数据库状态');
    console.log('   2. 确认数据库是否正在运行');
    console.log('   3. 可能需要重新获取 DATABASE_URL');
    console.log('   4. 或者在 Render 创建新的 PostgreSQL');

    await pool.end();
    process.exit(1);
  }
}

testPostgres();