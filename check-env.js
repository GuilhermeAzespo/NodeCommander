const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '.env');

let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

let changed = false;

if (!envContent.includes('JWT_SECRET=')) {
  const jwtSecret = crypto.randomBytes(64).toString('hex');
  envContent += `\nJWT_SECRET="${jwtSecret}"`;
  changed = true;
  console.log('✅ Generated new secure JWT_SECRET');
}

if (!envContent.includes('ENCRYPTION_KEY=')) {
  // AES-256-CBC needs 32 bytes (256 bits)
  const encKey = crypto.randomBytes(32).toString('hex');
  envContent += `\nENCRYPTION_KEY="${encKey}"`;
  changed = true;
  console.log('✅ Generated new secure ENCRYPTION_KEY');
}

if (changed) {
  fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
  console.log('🔒 .env updated with rigorous security keys.');
} else {
  console.log('🔒 Security keys already exist in .env.');
}
