import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedContent {
  url: string;
  pageTitle: string;
  text: string;
}

export class ScraperService {
  private static readonly BROWSER_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

  private static readonly FACEBOOK_BOT_UA =
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

  private static readonly TELEGRAM_BOT_UA =
    'TelegramBot (like TwitterBot)';

  /**
   * Define a ordem de User-Agents recomendada com base no domínio da URL
   */
  private static getCandidateUserAgents(url: string): string[] {
    const lowerUrl = url.toLowerCase();
    const isMeta =
      lowerUrl.includes('facebook.com') ||
      lowerUrl.includes('fb.watch') ||
      lowerUrl.includes('fb.me') ||
      lowerUrl.includes('instagram.com') ||
      lowerUrl.includes('threads.net');

    const isTwitterOrTiktok =
      lowerUrl.includes('twitter.com') ||
      lowerUrl.includes('x.com') ||
      lowerUrl.includes('tiktok.com');

    if (isMeta) {
      // Redes Meta bloqueiam navegadores normais sem sessão/cookies com erro 400/login,
      // mas entregam HTML completo e OpenGraph para crawlers sociais oficiais.
      return [this.FACEBOOK_BOT_UA, this.TELEGRAM_BOT_UA, this.BROWSER_UA];
    }

    if (isTwitterOrTiktok) {
      return [this.TELEGRAM_BOT_UA, this.BROWSER_UA, this.FACEBOOK_BOT_UA];
    }

    // Padrão para sites convencionais: navegador padrão, com fallback para bot social
    return [this.BROWSER_UA, this.TELEGRAM_BOT_UA];
  }

  /**
   * Extrai texto limpo e relevante de uma página web
   */
  public static async scrapeUrl(url: string): Promise<ScrapedContent> {
    const userAgents = this.getCandidateUserAgents(url);
    let html = '';
    let lastError: any = null;

    // Tenta obter o HTML rodando os User-Agents candidatos em caso de erro (ex: 400, 403)
    for (const ua of userAgents) {
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent': ua,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          },
          timeout: 12000,
          maxRedirects: 10,
          maxContentLength: 10 * 1024 * 1024, // 10MB max
        });

        if (response.data && typeof response.data === 'string') {
          html = response.data;
          break;
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!html) {
      console.warn(
        `⚠️ [Scraper] Não foi possível fazer scraping completo de ${url}:`,
        lastError?.message || 'Falha desconhecida'
      );
      return {
        url,
        pageTitle: url,
        text: `Conteúdo da URL ${url}. Falha ao carregar texto completo da página (${lastError?.message || 'erro'}). Analise com base no link.`,
      };
    }

    try {
      const $ = cheerio.load(html);

      // Remove elementos irrelevantes e poluição visual
      $('script, style, noscript, nav, footer, header, aside, svg, iframe, form, button, .ads, #ads').remove();

      // Extrai título da página
      let pageTitle =
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        $('title').text().trim() ||
        'Sem título';

      // Remove prefixos comuns de redes sociais do título (ex: contadores de reações)
      pageTitle = pageTitle
        .replace(/^[\d.,\s\w\u00a0]+(reações|likes|curtidas|visualizações|views|compartilhamentos)[^|]*\|\s*/i, '')
        .trim();

      // Extrai descrição / resumo (essencial para vídeos, Reels, Shorts, posts de redes sociais)
      const description =
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="twitter:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        '';

      const siteName = $('meta[property="og:site_name"]').attr('content') || '';

      // Tenta priorizar áreas de conteúdo principal
      let mainText = '';
      const mainSelectors = ['article', 'main', '[role="main"]', '.post-content', '.article-body', '.content'];

      for (const selector of mainSelectors) {
        const el = $(selector);
        if (el.length > 0) {
          mainText = el.text();
          break;
        }
      }

      // Se nenhum seletor específico encontrou conteúdo, pega do body
      if (!mainText || mainText.trim().length < 100) {
        mainText = $('body').text();
      }

      // Limpeza de espaços em branco, quebras excessivas de linha
      const cleanBodyText = mainText
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();

      // Monta blocos de conteúdo enriquecido
      const contentParts: string[] = [];
      if (siteName) contentParts.push(`[Fonte: ${siteName}]`);
      if (pageTitle && pageTitle !== 'Sem título') contentParts.push(`Título: ${pageTitle}`);
      if (description) contentParts.push(`Descrição/Conteúdo:\n${description}`);

      const descPrefix = description.trim() ? description.trim().slice(0, 50) : null;
      if (cleanBodyText && cleanBodyText !== pageTitle && (!descPrefix || !cleanBodyText.includes(descPrefix))) {
        contentParts.push(`Conteúdo:\n${cleanBodyText}`);
      }

      const finalText = contentParts.length > 0 ? contentParts.join('\n\n') : cleanBodyText;

      // Limita a 10.000 caracteres para não estourar contexto desnecessariamente
      const truncatedText = finalText.slice(0, 10000);

      return {
        url,
        pageTitle: pageTitle || url,
        text: truncatedText || pageTitle || url,
      };
    } catch (parseError: any) {
      console.warn(`⚠️ [Scraper] Erro ao analisar HTML de ${url}:`, parseError.message);
      return {
        url,
        pageTitle: url,
        text: `Conteúdo da URL ${url}. Falha ao analisar conteúdo (${parseError.message}).`,
      };
    }
  }

  /**
   * Helper para extrair a primeira ou todas as URLs de uma mensagem de texto
   */
  public static extractUrls(text: string): string[] {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = text.match(urlRegex);
    if (!matches) return [];

    // Remove caracteres pontuação no final de URLs (como ponto, vírgula, parênteses)
    return matches.map((u) => u.replace(/[.,;!?)]+$/, ''));
  }
}
