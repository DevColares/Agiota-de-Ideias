import dotenv from 'dotenv';
dotenv.config();

import { ScraperService } from '../src/services/scraper.service.js';
import { geminiService } from '../src/services/gemini.service.js';

async function test() {
  const url = process.argv[2] || 'https://pt.wikipedia.org/wiki/Intelig%C3%AAncia_artificial';

  console.log(`\n🔍 [Teste] Analisando URL: ${url}`);
  console.log('--- 1. Scraping com Cheerio e Axios ---');
  const scraped = await ScraperService.scrapeUrl(url);
  console.log(`Título da página: ${scraped.pageTitle}`);
  console.log(`Caracteres extraídos: ${scraped.text.length}`);

  console.log(`\n--- 2. Síntese Estruturada com Gemini (${process.env.GEMINI_MODEL || 'gemini-3.5-flash'}) ---`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY não configurada no .env. Configure para testar a chamada real.');
    return;
  }

  const resultado = await geminiService.analisarLink(url, scraped.pageTitle, scraped.text);
  console.log('\n✅ Resultado Estruturado recebido do Gemini:');
  console.log(JSON.stringify(resultado, null, 2));
}

test().catch(console.error);
