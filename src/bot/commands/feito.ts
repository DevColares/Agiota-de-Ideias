import { Context } from 'telegraf';
import { firestoreService } from '../../services/firestore.service.js';

export async function handleFeito(ctx: Context): Promise<void> {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Extrai o argumento após o comando /feito
  // Exemplo de mensagem: "/feito a1b2c3" -> args = ["a1b2c3"]
  const text = (ctx.message as any)?.text || '';
  const parts = text.trim().split(/\s+/);
  const idInformado = parts[1];

  if (!idInformado) {
    await ctx.reply(
      `⚠️ *Você precisa informar o ID do link!*\n\n` +
      `Exemplo de uso:\n` +
      `\`/feito 9f2a1b\`\n\n` +
      `💡 _Não sabe o ID? Use \`/pendentes\` para ver sua lista._`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  try {
    const linkConcluido = await firestoreService.concluirLink(userId, idInformado);

    if (!linkConcluido) {
      await ctx.reply(
        `❌ *Link não encontrado!*\n\n` +
        `Não encontrei nenhum link pendente com o ID \`${idInformado}\` na sua conta.\n` +
        `Verifique se o ID está correto com o comando \`/pendentes\`.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const elogios = [
      'Menos uma aba aberta na sua mente e mais um passo rumo ao sucesso!',
      'Orgulho do seu Agiota! Você realmente colocou a mão na massa!',
      'Dívida intelectual liquidada com honra! Continue assim!',
      'Um verdadeiro executor em meio a um mar de procrastinadores!',
    ];
    const elogioAleatorio = elogios[Math.floor(Math.random() * elogios.length)];

    await ctx.reply(
      `🎉 *PARABÉNS! DÍVIDA QUITADA!* ✅\n\n` +
      `📌 *Concluído:* "${linkConcluido.titulo}"\n\n` +
      `💬 _${elogioAleatorio}_\n\n` +
      `O status deste link agora é *CONCLUIDO* e as cobranças foram canceladas.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('❌ [handleFeito] Erro ao concluir link:', error);
    await ctx.reply('⚠️ Ocorreu um erro ao atualizar o status no banco de dados.');
  }
}
