import { Telegraf } from 'telegraf';
import { ENV } from '../config/env.js';
import { handleStart } from './commands/start.js';
import { handlePendentes } from './commands/pendentes.js';
import { handleFeito } from './commands/feito.js';
import { handleAdiar } from './commands/adiar.js';
import { handleLinkMessage } from './handlers/link.handler.js';

export const bot = new Telegraf(ENV.TELEGRAM_BOT_TOKEN);

export function setupBot(): Telegraf {
  // Comandos de Início e Ajuda
  bot.command('start', handleStart);
  bot.command('ajuda', handleStart);
  bot.command('help', handleStart);

  // Comandos de Gestão
  bot.command('pendentes', handlePendentes);
  bot.command('feito', handleFeito);
  bot.command('adiar', handleAdiar);

  // Handler de Mensagens de Texto (Links ou Outros)
  bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();

    // Se começou com barra '/', é comando não reconhecido
    if (text.startsWith('/')) {
      await ctx.reply(
        `❓ *Comando não reconhecido!*\n\n` +
        `Comandos válidos:\n` +
        `• \`/pendentes\` — Listar seus links pendentes\n` +
        `• \`/feito <id>\` — Concluir um link\n` +
        `• \`/adiar <id> <dias>\` — Adiar cobrança\n` +
        `• \`/ajuda\` — Instruções do bot`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Tenta processar como link
    const foiLink = await handleLinkMessage(ctx);

    if (!foiLink) {
      await ctx.reply(
        `💬 Envie uma mensagem contendo uma *URL válida* (ex: \`https://...\`) para eu criar o plano de ação!\n\n` +
        `Ou consulte suas dívidas com \`/pendentes\`.`,
        { parse_mode: 'Markdown' }
      );
    }
  });

  // Tratamento de erros do Telegraf
  bot.catch((err: any, ctx) => {
    console.error(`❌ [Telegraf] Erro durante processamento do update ${ctx.update.update_id}:`, err);
  });

  return bot;
}
