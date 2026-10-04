import { Context } from 'telegraf';

export async function handleStart(ctx: Context): Promise<void> {
  const nome = ctx.from?.first_name || 'Guerreiro(a)';

  const mensagem =
    `👋 *Fala aí, ${nome}! Eu sou o seu Fiscal de Execução (Agiota de Ideias)!* 😈📚\n\n` +
    `Cansado de salvar 500 links, abrir 80 abas no navegador e fingir que vai ler depois? *Seus problemas (ou pesadelos) começaram!*\n\n` +
    `🎯 *Como eu funciono:*\n` +
    `1. *Envie qualquer link* de artigo, vídeo, post ou notícia aqui no chat.\n` +
    `2. Eu leio o conteúdo e uso o *Gemini 3.5 Flash* para resumir a essência em 1 frase e criar um *Checklist de 3 Passos Práticos*.\n` +
    `3. Eu estipulo um prazo de execução (1 a 3 dias).\n` +
    `4. Se o prazo vencer e você não tiver concluído, meu *Cron Job de Cobrança* vai te mandar mensagens sarcásticas e insistentes até você agir!\n\n` +
    `📋 *Comandos de Controle:*\n` +
    `• \`/pendentes\` — Lista todas as suas dívidas intelectuais ativas.\n` +
    `• \`/feito <id>\` — Marca o link como concluído e zera a cobrança.\n` +
    `• \`/adiar <id> <dias>\` — Pede arrego e prorroga o prazo por mais alguns dias.\n` +
    `• \`/ajuda\` — Relembra estas instruções.\n\n` +
    `🚀 *Manda um link aí agora e vamos ver se você é de ação!*`;

  await ctx.reply(mensagem, { parse_mode: 'Markdown' });
}
