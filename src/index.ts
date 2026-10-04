import { validateEnv, ENV } from './config/env.js';
import { initFirebase, db } from './config/firebase.js';
import { setupBot } from './bot/index.js';
import { iniciarCronCobranca } from './cron/cobranca.cron.js';

async function bootstrap() {
  console.log('====================================================');
  console.log('🤖 Agiota de Ideias - Fiscal de Execução Telegram Bot');
  console.log('====================================================');

  // 1. Valida variáveis de ambiente
  validateEnv();

  // 2. Inicializa Firestore e testa conectividade
  try {
    initFirebase();
    // Teste de conexão não bloqueante com o Firestore
    db.collection('links')
      .limit(1)
      .get()
      .then(() => {
        console.log('✅ [Firebase] Conexão com Cloud Firestore estabelecida com sucesso!');
      })
      .catch((err: any) => {
        if (err?.code === 7 || err?.message?.includes('Cloud Firestore API has not been used')) {
          console.warn('\n⚠️ [ATENÇÃO - FIREBASE FIRESTORE]');
          console.warn('O banco de dados Firestore ainda não foi criado no console do Firebase.');
          console.warn(`👉 Acesse https://console.firebase.google.com/project/${ENV.FIREBASE_PROJECT_ID}/firestore`);
          console.warn('👉 Clique em "Criar banco de dados" (pode escolher "Modo de Produção" ou "Modo de Teste").\n');
        } else {
          console.warn('⚠️ [Firebase] Aviso ao testar conexão Firestore:', err.message);
        }
      });
  } catch (error: any) {
    console.error('❌ [Firebase] Erro ao inicializar Firebase Admin:', error?.message || error);
  }

  // 3. Configura o bot Telegraf
  const bot = setupBot();

  // 4. Inicia o agendador de cobrança
  iniciarCronCobranca(bot);

  // 5. Inicia o bot do Telegram
  try {
    const botInfo = await bot.telegram.getMe();
    console.log(`🚀 [Telegram Bot] Conectado como @${botInfo.username}! Pronto para receber mensagens.`);
    console.log(`🤖 Modelo Gemini: ${ENV.GEMINI_MODEL}`);
    console.log(`⏰ Cron agendado com: "${ENV.CRON_SCHEDULE}"\n`);

    // Inicia o polling do Telegraf (sem travar o output)
    bot.launch().catch((err) => {
      console.error('❌ [Telegram Bot] Erro no polling do Telegram:', err);
    });
  } catch (err: any) {
    console.error('❌ [Telegram Bot] Falha ao conectar com Telegram API. Verifique o TELEGRAM_BOT_TOKEN no .env.');
    console.error(err?.message || err);
  }

  // Encerramento gracioso
  const stopHandler = (signal: string) => {
    console.log(`\n🛑 [Shutdown] Recebido sinal ${signal}. Encerrando bot...`);
    bot.stop(signal);
    process.exit(0);
  };

  process.once('SIGINT', () => stopHandler('SIGINT'));
  process.once('SIGTERM', () => stopHandler('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('💥 Erro fatal na inicialização da aplicação:', err);
  process.exit(1);
});
