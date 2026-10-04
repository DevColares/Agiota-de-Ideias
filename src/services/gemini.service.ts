import { GoogleGenAI, Type } from '@google/genai';
import { ENV } from '../config/env.js';
import type { GeminiAnalysis, LinkDocument } from '../types/link.js';

export class GeminiService {
  private ai: GoogleGenAI;
  private model: string;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });
    this.model = ENV.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  /**
   * Analisa o conteúdo extraído da página e gera um resumo executivo com checklist prático
   */
  public async analisarLink(
    url: string,
    pageTitle: string,
    pageText: string
  ): Promise<GeminiAnalysis> {
    const prompt = `Você é um analista de produtividade e síntese de conhecimento focado em execução prática ("Action-Oriented Summary").
Analise o conteúdo do link abaixo e retorne um plano de ação direto ao ponto:

URL: ${url}
Título Original da Página: ${pageTitle}
Conteúdo Extraído:
${pageText}

Instruções obrigatórias:
1. "titulo": Resumo executivo em EXATAMENTE 1 frase com impacto direto (máximo 120 caracteres), explicando o valor central do conteúdo.
2. "checklist": Uma lista com EXATAMENTE 3 passos ultra-práticos, objetivos e acionáveis para o usuário colocar esse conhecimento em prática na vida real.
3. "dias_prazo_sugerido": Um número inteiro entre 1 e 3 representando o prazo sugerido em dias para cobrar a execução deste checklist.`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              titulo: {
                type: Type.STRING,
                description: 'Resumo executivo do conteúdo do link em 1 frase objetiva.',
              },
              checklist: {
                type: Type.ARRAY,
                items: {
                  type: Type.STRING,
                },
                description: 'Exatamente 3 passos práticos para colocar o conteúdo em prática.',
              },
              dias_prazo_sugerido: {
                type: Type.INTEGER,
                description: 'Prazo em dias sugerido para cobrar o usuário (1 a 3 dias).',
              },
            },
            required: ['titulo', 'checklist', 'dias_prazo_sugerido'],
          },
        },
      });

      const responseText = response.text?.trim() || '{}';
      const parsed = JSON.parse(responseText);

      return {
        titulo: String(parsed.titulo || pageTitle || 'Conteúdo salvo').trim(),
        checklist: Array.isArray(parsed.checklist) && parsed.checklist.length > 0
          ? parsed.checklist.slice(0, 3).map(String)
          : [
              'Ler/assistir o material com atenção',
              'Aplicar o ponto principal em um projeto ou rotina',
              'Validar os resultados obtidos',
            ],
        dias_prazo_sugerido:
          typeof parsed.dias_prazo_sugerido === 'number' && parsed.dias_prazo_sugerido >= 1
            ? Math.min(parsed.dias_prazo_sugerido, 7)
            : 2,
      };
    } catch (error: any) {
      if (error?.status === 400 || error?.message?.includes('API key not valid')) {
        console.error('❌ [GeminiService] Chave GEMINI_API_KEY inválida no .env! As chaves oficiais do Google AI Studio começam com "AIzaSy".');
      } else {
        console.error('❌ [GeminiService] Erro ao analisar link com Gemini:', error?.message || error);
      }
      // Fallback gracioso
      return {
        titulo: pageTitle || 'Leitura de link salvo',
        checklist: [
          'Abrir o link e revisar o conteúdo',
          'Extrair os 3 pontos mais importantes',
          'Executar a primeira ação prática sugerida',
        ],
        dias_prazo_sugerido: 2,
      };
    }
  }

  /**
   * Gera uma mensagem divertida, provocativa e personalizada para cobrar o usuário
   */
  public async gerarMensagemCobranca(link: LinkDocument): Promise<string> {
    const checklistFormatado = link.checklist
      .map((item, index) => `${index + 1}. ${item}`)
      .join('\n');

    const prompt = `Você é o "Agiota de Ideias" ou "Fiscal de Perturbação", um bot sarcástico, provocativo, insistente, porém bem-humorado.
Sua função é cobrar implacavelmente usuários que salvam links na internet e nunca colocam em prática (acumuladores de abas abertas).

Dados da dívida de conhecimento:
- Nome do usuário: ${link.user_name || 'Procrastinador profissional'}
- Título do link: "${link.titulo}"
- URL original: ${link.url}
- Checklist que o usuário deveria ter feito:
${checklistFormatado}
- Tentativa de cobrança atual: ${link.tentativas_cobranca + 1}ª cobrança!
- ID de cobrança: ${link.short_id}

Diretrizes da mensagem:
1. Seja criativo, espirituoso e use ironia fina / sarcasmo saudável sem ser ofensivo.
2. Mencione explicitamente pelo menos um dos passos do checklist para confrontar a falta de execução.
3. Se for a 2ª ou 3ª cobrança, aumente o nível de deboche ("os juros do conhecimento estão correndo").
4. A mensagem deve ter entre 3 a 5 frases no máximo, use emojis com moderação para dar ênfase cômica.
5. Ao final, instrua claramente como pagar essa dívida de honra:
   Digite: \`/feito ${link.short_id}\` para liquidar a fatura
   Ou: \`/adiar ${link.short_id} 1\` para pedir arrego de mais 1 dia.`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
      });

      const message = response.text?.trim();
      if (message) {
        return message;
      }
    } catch (error: any) {
      if (error?.status === 400 || error?.message?.includes('API key not valid')) {
        console.error('❌ [GeminiService] Chave GEMINI_API_KEY inválida ao gerar cobrança!');
      } else {
        console.error('❌ [GeminiService] Erro ao gerar mensagem de cobrança:', error?.message || error);
      }
    }

    // Fallback padrão se houver falha na API do Gemini
    return `🚨 *TOC TOC! O AGOTA DE IDEIAS CHEGOU!* 🚨\n\n` +
      `Lembra disso aqui?\n` +
      `📌 *"${link.titulo}"*\n\n` +
      `O prazo venceu e até agora nada! Você prometeu fazer:\n` +
      `${checklistFormatado}\n\n` +
      `Vai continuar acumulando aba aberta ou vai agir?\n\n` +
      `✅ Terminou? Digite: \`/feito ${link.short_id}\`\n` +
      `⏳ Precisa de arrego? Digite: \`/adiar ${link.short_id} 2\``;
  }
}

export const geminiService = new GeminiService();
