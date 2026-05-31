import fs from 'fs';
import path from 'path';

const migrationsDir = './supabase/migrations';

function concat() {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
    
  let combinedSql = '';
  for (const file of files) {
    combinedSql += `\n\n-- ==========================================\n`;
    combinedSql += `-- MIGRATION: ${file}\n`;
    combinedSql += `-- ==========================================\n\n`;
    combinedSql += fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  }
  
  fs.writeFileSync('./scratch/combined_migration.sql', combinedSql);
  console.log('Concatenated successfully! Size:', combinedSql.length, 'bytes');
}

concat();
