import { Context } from 'telegraf';
import { Timestamp } from 'firebase-admin/firestore';
import { firestoreService } from '../../services/firestore.service.js';

export async function handleAdiar(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Extrai argumentos: /adiar <id> <dias>
  const text = (ctx.message as any)?.text || '';
  const parts = text.trim().split(/\s+/);
  const idInformado = parts[1];
  const diasStr = parts[2];

  if (!idInformado) {
    await ctx.reply(
      `⚠️ *Como usar o comando /adiar:*\n\n` +
      `\`/adiar <id_do_link> <dias>\`\n\n` +
      `*Exemplo:* Para adiar o link \`a1b2c3\` por 2 dias:\n` +
      `\`/adiar a1b2c3 2\`\n\n` +
      `💡 _Consulte seus IDs com \`/pendentes\`._`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const dias = parseInt(diasStr || '1', 10);
  if (isNaN(dias) || dias <= 0 || dias > 30) {
    await ctx.reply(
      `⚠️ Por favor, informe um número de dias válido entre 1 e 30.\nExemplo: \`/adiar ${idInformado} 3\``
    );
    return;
  }

  try {
    const linkAdiado = await firestoreService.adiarLink(userId, idInformado, dias);

    if (!linkAdiado) {
      await ctx.reply(
        `❌ *Link não encontrado!*\n\n` +
        `Não encontrei nenhum link pendente com o ID \`${idInformado}\`.\n` +
        `Verifique com \`/pendentes\`.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const dateObj = (linkAdiado.data_cobranca as Timestamp).toDate
      ? (linkAdiado.data_cobranca as Timestamp).toDate()
      : new Date(linkAdiado.data_cobranca as any);

    const dataFormatada = dateObj.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    await ctx.reply(
      `⏳ *ARREGO CONCEDIDO... MAS COM JUROS!* 😅\n\n` +
      `📌 *Link:* "${linkAdiado.titulo}"\n` +
      `📅 *Novo prazo de cobrança:* ${dataFormatada} (+${dias} ${dias === 1 ? 'dia' : 'dias'})\n\n` +
      `Aproveite a trégua para executar o checklist antes que eu volte batendo na sua porta! 🚪💥`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('❌ [handleAdiar] Erro ao adiar cobrança do link:', error);
    await ctx.reply('⚠️ Ocorreu um erro ao atualizar o prazo no Firestore.');
  }
}
