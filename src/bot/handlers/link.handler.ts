import { Context } from 'telegraf';
import { Timestamp } from 'firebase-admin/firestore';
import { ScraperService } from '../../services/scraper.service.js';
import { geminiService } from '../../services/gemini.service.js';
import { firestoreService } from '../../services/firestore.service.js';

export async function handleLinkMessage(ctx: Context): Promise<boolean> {
  const text = (ctx.message as any)?.text || '';
  const urls = ScraperService.extractUrls(text);

  if (urls.length === 0) {
    return false; // Não contém link
  }

  const url = urls[0];
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const userName = ctx.from?.first_name || 'Usuário';

  if (!userId || !chatId) {
    return false;
  }

  // Notifica o usuário que o processamento começou
  const statusMsg = await ctx.reply(
    `🔍 *Link detectado!*\n` +
    `Lendo o conteúdo da página e sintetizando com o *Gemini 2.5 Flash*... Aguarde um instante! 🧠⚡`,
    { parse_mode: 'Markdown' }
  );

  try {
    // 1. Scraping da página
    const scraped = await ScraperService.scrapeUrl(url);

    // 2. Análise e geração do checklist com Gemini
    const analise = await geminiService.analisarLink(url, scraped.pageTitle, scraped.text);

    // 3. Salvar no Firestore
    const savedLink = await firestoreService.salvarLink({
      user_id: userId,
      chat_id: chatId,
      user_name: userName,
      url,
      titulo: analise.titulo,
      checklist: analise.checklist,
      dias_prazo_sugerido: analise.dias_prazo_sugerido,
    });

    const dateObj = (savedLink.data_cobranca as Timestamp).toDate
      ? (savedLink.data_cobranca as Timestamp).toDate()
      : new Date(savedLink.data_cobranca as any);

    const dataFormatada = dateObj.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const checklistText = analise.checklist
      .map((item, idx) => `  ${idx + 1}️⃣  ${item}`)
      .join('\n');

    const resposta =
      `🎯 *PLANO DE EXECUÇÃO CRIADO COM SUCESSO!* 🚀\n\n` +
      `📌 *Resumo Executivo:*\n` +
      `"${analise.titulo}"\n\n` +
      `📝 *Checklist de Ação (Próximos Passos):*\n` +
      `${checklistText}\n\n` +
      `⏱️ *Prazo Estipulado:* ${analise.dias_prazo_sugerido} ${analise.dias_prazo_sugerido === 1 ? 'dia' : 'dias'}\n` +
      `🔔 *Primeira Cobrança:* ${dataFormatada}\n` +
      `🔑 *ID:* \`${savedLink.short_id}\`\n\n` +
      `───────────────\n` +
      `✅ *Quando terminar:* \`/feito ${savedLink.short_id}\`\n` +
      `⏳ *Se precisar prorrogar:* \`/adiar ${savedLink.short_id} 2\``;

    // Remove mensagem temporária e envia resultado
    try {
      await ctx.deleteMessage(statusMsg.message_id);
    } catch {
      // Se não der para deletar mensagem temporária, tudo bem
    }

    await ctx.reply(resposta, {
      parse_mode: 'Markdown',
      link_preview_options: { is_disabled: true },
    });

    return true;
  } catch (error: any) {
    console.error('❌ [handleLinkMessage] Erro ao processar link:', error);
    await ctx.reply(
      `⚠️ *Ops! Tive um problema ao processar este link.*\n\n` +
      `Detalhes: ${error?.message || 'Erro inesperado'}.\n` +
      `Tente novamente ou envie outro link.`,
      { parse_mode: 'Markdown' }
    );
    return true;
  }
}
