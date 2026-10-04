import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { ENV } from '../config/env.js';
import { firestoreService } from '../services/firestore.service.js';
import { geminiService } from '../services/gemini.service.js';

/**
 * Executa uma rodada da rotina de cobrança
 */
export async function executarRotinaCobranca(bot: Telegraf): Promise<void> {
  console.log(`⏰ [Cron] Iniciando verificação de links vencidos (${new Date().toISOString()})...`);

  try {
    const linksVencidos = await firestoreService.buscarLinksParaCobranca();

    if (linksVencidos.length === 0) {
      console.log('✨ [Cron] Nenhum link vencido para cobrança no momento.');
      return;
    }

    console.log(`🚨 [Cron] Encontrados ${linksVencidos.length} link(s) aguardando cobrança.`);

    for (const link of linksVencidos) {
      if (!link.id || !link.chat_id) continue;

      try {
        console.log(`📣 [Cron] Cobrando usuário ${link.chat_id} referente ao link [${link.short_id}] "${link.titulo}"...`);

        // 1. Gera mensagem provocativa e personalizada via Gemini
        const mensagem = await geminiService.gerarMensagemCobranca(link);

        // 2. Envia mensagem via Telegram
        await bot.telegram.sendMessage(link.chat_id, mensagem, {
          parse_mode: 'Markdown',
          link_preview_options: { is_disabled: true },
        });

        // 3. Atualiza data_cobranca para +24h e incrementa tentativas_cobranca
        const novaDataCobranca = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await firestoreService.registrarCobrancaRealizada(link.id, novaDataCobranca);

        console.log(`✅ [Cron] Cobrança enviada com sucesso para o link [${link.short_id}]. Próxima: +24h.`);

        // Pausa de 800ms entre envios para respeitar limites do Telegram
        await new Promise((resolve) => setTimeout(resolve, 800));
      } catch (err: any) {
        console.error(`❌ [Cron] Falha ao cobrar link ${link.short_id} (chat_id: ${link.chat_id}):`, err.message);
      }
    }
  } catch (error) {
    console.error('❌ [Cron] Erro geral na execução da rotina de cobrança:', error);
  }
}

/**
 * Inicializa o agendamento periódico com node-cron
 */
export function iniciarCronCobranca(bot: Telegraf): cron.ScheduledTask {
  const expressaoCron = ENV.CRON_SCHEDULE;
  console.log(`⏳ [Cron] Agendador registrado com a expressão: "${expressaoCron}"`);

  const task = cron.schedule(expressaoCron, async () => {
    await executarRotinaCobranca(bot);
  });

  return task;
}
