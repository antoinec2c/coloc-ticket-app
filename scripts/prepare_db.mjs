import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

const dbUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;

if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
  console.log('🔄 Configuring Prisma for PostgreSQL (Vercel / Cloud DB)...');
  schema = schema.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
  schema = schema.replace(/url\s*=\s*"file:\.\/dev\.db"/g, 'url = env("DATABASE_URL")');
  fs.writeFileSync(schemaPath, schema);
  
  if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
    process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
  }

  // Auto-sync schema tables on Postgres during build
  try {
    console.log('⚡ Pushing Prisma schema to PostgreSQL...');
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: dbUrl }
    });
  } catch (err) {
    console.warn('⚠️ Warning: prisma db push failed (will continue build):', err.message);
  }
} else {
  console.log('📁 Configuring Prisma for SQLite (Local)...');
  schema = schema.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
  schema = schema.replace(/url\s*=\s*env\("DATABASE_URL"\)/g, 'url = "file:./dev.db"');
  fs.writeFileSync(schemaPath, schema);
}
