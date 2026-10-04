import { Context } from 'telegraf';
import { Timestamp } from 'firebase-admin/firestore';
import { firestoreService } from '../../services/firestore.service.js';

export async function handlePendentes(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply('❌ Não foi possível identificar o seu usuário.');
    return;
  }

  try {
    const pendentes = await firestoreService.buscarPendentesPorUsuario(userId);

    if (pendentes.length === 0) {
      await ctx.reply(
        `🎉 *Nenhuma dívida ativa!*\n\n` +
        `Você não tem nenhum link pendente no momento.\n` +
        `Ou você é incrivelmente produtivo... ou está com medo de mandar links! 😏\n\n` +
        `Envie um link para começarmos!`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let resposta = `📂 *SUAS DÍVIDAS DE EXECUÇÃO (${pendentes.length}):*\n\n`;

    pendentes.forEach((link, idx) => {
      let dataFormatada = 'Em breve';
      if (link.data_cobranca) {
        const dateObj = (link.data_cobranca as Timestamp).toDate
          ? (link.data_cobranca as Timestamp).toDate()
          : new Date(link.data_cobranca as any);
        
        dataFormatada = dateObj.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      const passos = link.checklist.map((p, i) => `   ${i + 1}. ${p}`).join('\n');

      resposta += `*#${idx + 1} — ${link.titulo}*\n`;
      resposta += `🔑 *ID:* \`${link.short_id}\`\n`;
      resposta += `⏰ *Cobrança:* ${dataFormatada} (${link.tentativas_cobranca} cobranças feitas)\n`;
      resposta += `🔗 [Acessar Link original](${link.url})\n`;
      resposta += `📝 *Checklist:*\n${passos}\n`;
      resposta += `👉 Concluir: \`/feito ${link.short_id}\` | Adiar: \`/adiar ${link.short_id} 2\`\n\n`;
      resposta += `────────────────────\n\n`;
    });

    await ctx.reply(resposta, {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
    });
  } catch (error) {
    console.error('❌ [handlePendentes] Erro ao buscar links pendentes:', error);
    await ctx.reply('⚠️ Ocorreu um erro ao consultar seus links pendentes no Firestore.');
  }
}
