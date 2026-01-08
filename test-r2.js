require('dotenv').config();
const { S3Client, PutObjectCommand, ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

// 显示配置信息（隐藏敏感部分）
console.log('📋 当前配置信息:');
console.log(`   Account ID: ${process.env.R2_ACCOUNT_ID}`);
console.log(`   Access Key: ${process.env.R2_ACCESS_KEY_ID?.substring(0, 8)}...`);
console.log(`   Secret Key: ${process.env.R2_SECRET_ACCESS_KEY ? '已设置 (长度: ' + process.env.R2_SECRET_ACCESS_KEY.length + ')' : '未设置'}`);
console.log(`   Bucket: ${process.env.R2_BUCKET_NAME}`);
console.log(`   Endpoint: ${process.env.R2_ENDPOINT}\n`);

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;

async function testR2() {
  try {
    // 测试 1: 列出 Buckets（这个需要最高权限）
    console.log('🧪 测试 1: 列出 Buckets (可能失败，没关系)');
    try {
      const listBuckets = new ListBucketsCommand({});
      const bucketsResult = await r2Client.send(listBuckets);
      console.log('✅ 列出 Buckets 成功:');
      bucketsResult.Buckets?.forEach(b => console.log(`   - ${b.Name}`));
    } catch (err) {
      console.log('⚠️  列出 Buckets 失败（可能是权限限制）:', err.message);
      console.log('   这是正常的，我们继续测试其他功能...\n');
    }

    // 测试 2: 列出指定 Bucket 的对象（权限要求较低）
    console.log('\n🧪 测试 2: 列出 Bucket 内容');
    const listObjects = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 5
    });
    
    const objectsResult = await r2Client.send(listObjects);
    console.log(`✅ 成功访问 Bucket: ${BUCKET_NAME}`);
    console.log(`   现有对象数: ${objectsResult.KeyCount || 0}`);
    if (objectsResult.Contents?.length > 0) {
      console.log('   现有文件:');
      objectsResult.Contents.forEach(obj => {
        console.log(`     - ${obj.Key}`);
      });
    } else {
      console.log('   (Bucket 为空)');
    }

    // 测试 3: 上传文件
    console.log('\n🧪 测试 3: 上传文件');
    const testKey = `test/${Date.now()}-test.txt`;
    const testContent = 'Hello R2! 测试成功！';
    
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: Buffer.from(testContent),
      ContentType: 'text/plain',
    });

    await r2Client.send(putCommand);
    console.log(`✅ 文件上传成功: ${testKey}`);

    // 测试 4: 再次列出对象，确认文件已上传
    console.log('\n🧪 测试 4: 验证文件已上传');
    const verifyList = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'test/'
    });
    
    const verifyResult = await r2Client.send(verifyList);
    console.log(`✅ test/ 文件夹中有 ${verifyResult.KeyCount} 个文件`);

    console.log('\n🎉 所有测试通过！R2 配置正确。\n');
    console.log('📝 下一步:');
    console.log('   1. 检查 Cloudflare R2 Dashboard');
    console.log('   2. 应该能看到 test/ 文件夹');
    console.log('   3. 可以开始集成到项目了！');

  } catch (error) {
    console.error('\n❌ 测试失败:');
    console.error('错误类型:', error.name);
    console.error('错误信息:', error.message);
    
    if (error.Code) {
      console.error('错误代码:', error.Code);
    }

    console.log('\n🔧 诊断建议:');
    
    if (error.message.includes('Access Denied') || error.Code === 'AccessDenied') {
      console.log('   ⚠️  权限问题！');
      console.log('   1. 检查 API Token 权限是否为 "Object Read & Write"');
      console.log('   2. 确认 Token 已应用到 Bucket: ' + BUCKET_NAME);
      console.log('   3. 尝试在 Cloudflare Dashboard 重新创建 Token');
      console.log('   4. 等待 2-3 分钟让 Token 生效');
    } else if (error.message.includes('InvalidAccessKeyId')) {
      console.log('   ⚠️  Access Key ID 错误！');
      console.log('   检查 R2_ACCESS_KEY_ID 是否正确复制');
    } else if (error.message.includes('SignatureDoesNotMatch')) {
      console.log('   ⚠️  Secret Access Key 错误！');
      console.log('   检查 R2_SECRET_ACCESS_KEY 是否正确复制');
    } else if (error.message.includes('NoSuchBucket')) {
      console.log('   ⚠️  Bucket 不存在！');
      console.log('   检查 R2_BUCKET_NAME 是否正确: ' + BUCKET_NAME);
    } else {
      console.log('   未知错误，请检查所有配置');
    }
  }
}

testR2();