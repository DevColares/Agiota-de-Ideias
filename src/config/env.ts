import dotenv from 'dotenv';
import path from 'path';

// Carrega variáveis do arquivo .env
dotenv.config();

export const ENV = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  
  // Cron schedule: padrão roda a cada 1 hora ('0 * * * *')
  // Pode ser configurado para testes (ex: '*/5 * * * *' para cada 5 min)
  CRON_SCHEDULE: process.env.CRON_SCHEDULE || '0 * * * *',

  // Configuração Firebase
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_SERVICE_ACCOUNT_PATH: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
  FIREBASE_SERVICE_ACCOUNT_KEY: process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '',

  NODE_ENV: process.env.NODE_ENV || 'development',
};

export function validateEnv(): void {
  const missing: string[] = [];

  if (!ENV.TELEGRAM_BOT_TOKEN) {
    missing.push('TELEGRAM_BOT_TOKEN');
  }

  if (!ENV.GEMINI_API_KEY) {
    missing.push('GEMINI_API_KEY');
  }

  if (missing.length > 0) {
    console.error('❌ [ERRO DE CONFIGURAÇÃO] Variáveis de ambiente obrigatórias não encontradas:');
    missing.forEach((v) => console.error(`   - ${v}`));
    console.error('\nPor favor, preencha o arquivo .env com base no .env.example.');
  }
}
