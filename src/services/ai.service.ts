import axios from 'axios';
import { AppError } from '../errors/app-error.js';
import { AuthUser } from '../middlewares/auth.js';
import { productService } from './product.service.js';
import { prisma } from '../lib/prisma.js';
import type { VoiceIntent } from '../schemas/ai.schema.js';
interface TranscribeOptions {
  audioBuffer: Buffer;
  filename?: string;
  language?: string;
  prompt?: string;
  temperature?: number;
  model?: string;
}

interface ChatPromptOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  jsonMode?: boolean;
}

interface GroqChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    total_time?: number;
  };
}

interface GroqTranscribeResponse {
  text?: string;
  duration?: number;
}

interface GroqModelsResponse {
  data?: Array<{
    id: string;
    object: string;
    owned_by: string;
    active: boolean;
  }>;
}

interface MatchedProductSummary {
  id: string;
  name: string;
  barcode: string;
  price: number | null;
  depotQty: number;
  shelfQty: number;
}

interface ActionItem {
  action: 'UPDATE_PRODUCT' | 'STOCK_ENTRY' | 'TRANSFER_STOCK' | 'POS_SALE' | 'CHECK_STOCK' | 'REGISTER_PRODUCT';
  productQuery?: string;
  price?: number;
  quantity?: number;
  depotQty?: number;
  shelfQty?: number;
  from?: 'depot' | 'shelf';
  to?: 'depot' | 'shelf';
  destination?: 'depot' | 'shelf';
  depotLocation?: string;
  shelfLocation?: string;
  shelfMinQty?: number;
  barcode?: string;
  paymentMethod?: 'MONEY' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX';
  matchedProduct?: MatchedProductSummary | null;
  executed?: boolean;
  result?: unknown;
}

export type { VoiceIntent };

export interface UniversalBatchConfig {
  operation?: 'TRANSFER' | 'UPDATE_PRICE' | 'STOCK_ENTRY';
  scope?: 'ALL' | 'CRITICAL_ONLY' | 'CATEGORY' | 'SPECIFIC';
  category?: string | null;
  from?: 'depot' | 'shelf' | null;
  to?: 'depot' | 'shelf' | null;
  quantityRule?: 'DEFICIT' | 'ALL' | 'EXACT' | 'PERCENTAGE';
  quantityValue?: number | null;
  percentage?: number | null;
  newPrice?: number | null;
}
export interface UniversalDirectAction {
  action: 'TRANSFER_STOCK' | 'STOCK_ENTRY' | 'UPDATE_PRODUCT' | 'POS_SALE' | 'REGISTER_PRODUCT' | 'CHECK_STOCK';
  productQuery?: string | null;
  quantity?: number | null;
  price?: number | null;
  from?: 'depot' | 'shelf' | null;
  to?: 'depot' | 'shelf' | null;
  destination?: 'depot' | 'shelf' | null;
}

interface ParsedUniversalVoiceResponse {
  isBatch?: boolean;
  batchConfig?: UniversalBatchConfig;
  directActions?: UniversalDirectAction[];
  intent?: VoiceIntent;
  explanation?: string;
}

const STOPWORDS: Record<string, true> = {
  de: true,
  do: true,
  da: true,
  dos: true,
  das: true,
  com: true,
  sem: true,
  em: true,
  para: true,
  pra: true,
  pro: true,
  e: true,
  o: true,
  a: true,
  os: true,
  as: true,
  un: true,
  unidades: true,
  lata: true,
  litro: true,
  litros: true,
  '2l': true,
  '1l': true,
  quero: true,
  agora: true,
  seja: true,
  tambem: true,
  também: true,
  unidade: true,
  produto: true,
  produtos: true,
  adiciona: true,
  cadastra: true,
  ele: true,
  tem: true,
  no: true,
  na: true,
};

export class GroqService {
  private getApiKey(): string {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new AppError(
        'A chave de API da Groq (GROQ_API_KEY) não está configurada no ambiente (.env).',
        500
      );
    }
    return apiKey;
  }

  private getBaseUrl(): string {
    return process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
  }

  /**
   * Consulta a API da Groq em tempo real para obter a lista de modelos ativos na conta.
   */
  async listAvailableModels() {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();

    try {
      const response = await axios.get<GroqModelsResponse>(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      return response.data.data || [];
    } catch (error: unknown) {
      let detail = 'Falha ao listar modelos do Groq';
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data as { error?: { message?: string } } | undefined;
        detail = errorData?.error?.message || error.message;
      } else if (error instanceof Error) {
        detail = error.message;
      }
      throw new AppError(`Erro ao consultar modelos disponíveis na Groq: ${detail}`, 502);
    }
  }

  /**
   * Obtém dinamicamente o melhor modelo de chat disponível na conta.
   */
  private async resolveChatModels(requestedModel?: string): Promise<string[]> {
    if (requestedModel) {
      return [requestedModel];
    }

    if (process.env.GROQ_CHAT_MODEL) {
      return [process.env.GROQ_CHAT_MODEL];
    }

    try {
      const activeModels = await this.listAvailableModels();
      const chatModelIds = activeModels
        .map((m) => m.id)
        .filter(
          (id) =>
            !id.includes('whisper') &&
            !id.includes('guard') &&
            !id.includes('embedding')
        );

      if (chatModelIds.length > 0) {
        const sorted = [...chatModelIds].sort((a, b) => {
          const priority = (id: string) => {
            if (id.includes('70b') || id.includes('llama-3.3')) return 1;
            if (id.includes('8b') || id.includes('instant')) return 2;
            if (id.includes('qwen') || id.includes('gemma')) return 3;
            return 4;
          };
          return priority(a) - priority(b);
        });
        return sorted;
      }
    } catch {
      // Fallback estático
    }

    return [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'qwen-2.5-32b',
      'gemma2-9b-it',
    ];
  }

  /**
   * Transcreve áudio com Whisper da Groq Cloud.
   */
  async transcribeAudio(options: TranscribeOptions) {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();

    const filename = options.filename || 'audio.m4a';
    const language = options.language || 'pt';
    const prompt =
      options.prompt ||
      'Vocabulário de varejo brasileiro: gôndola, depósito, reposição, compra, entrada de mercadoria, estoque, preço, reajuste, transferência, caixa, EAN, fardo, pacote, unidade, Guaraná Antarctica Zero, Guaraná Antarctica 2 litros, Pepsi Twist, Coca-Cola, refrigerante, cerveja, leite, arroz, feijão.';

    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeType =
      ext === 'mp3'
        ? 'audio/mpeg'
        : ext === 'wav'
        ? 'audio/wav'
        : ext === 'ogg' || ext === 'oga'
        ? 'audio/ogg'
        : ext === 'webm'
        ? 'audio/webm'
        : ext === 'flac'
        ? 'audio/flac'
        : 'audio/m4a';

    const candidateModels = [
      options.model || process.env.GROQ_AUDIO_MODEL || 'whisper-large-v3',
      'whisper-large-v3-turbo',
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    let lastErrorDetail = '';

    for (const model of candidateModels) {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(options.audioBuffer)], {
        type: mimeType,
      });

      formData.append('file', blob, filename);
      formData.append('model', model);
      formData.append('language', language);
      formData.append('response_format', 'verbose_json');
      formData.append('temperature', String(options.temperature ?? 0));
      if (prompt) {
        formData.append('prompt', prompt);
      }

      try {
        const response = await axios.post<GroqTranscribeResponse>(
          `${baseUrl}/audio/transcriptions`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        return {
          text: response.data.text || '',
          model,
          duration: response.data.duration,
        };
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          const errorData = error.response?.data as { error?: { message?: string } } | undefined;
          lastErrorDetail = errorData?.error?.message || error.message;
        } else if (error instanceof Error) {
          lastErrorDetail = error.message;
        }
      }
    }

    throw new AppError(`Erro ao transcrever áudio com Groq Whisper: ${lastErrorDetail}`, 502);
  }

  /**
   * Executa inferência com chat completions descobrindo modelos ativos dinamicamente.
   */
  async chatPrompt(options: ChatPromptOptions) {
    const apiKey = this.getApiKey();
    const baseUrl = this.getBaseUrl();

    const candidateModels = await this.resolveChatModels(options.model);

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: options.prompt,
    });

    let lastErrorDetail = '';

    for (const model of candidateModels) {
      const payload: {
        model: string;
        messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
        temperature: number;
        response_format?: { type: 'json_object' };
      } = {
        model,
        messages,
        temperature: options.temperature ?? 0.1,
      };

      if (options.jsonMode) {
        payload.response_format = { type: 'json_object' };
      }

      try {
        const response = await axios.post<GroqChatResponse>(`${baseUrl}/chat/completions`, payload, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        const messageContent = response.data.choices?.[0]?.message?.content || '';
        let parsedJson: unknown = null;

        if (options.jsonMode) {
          try {
            parsedJson = JSON.parse(messageContent);
          } catch {
            parsedJson = null;
          }
        }

        return {
          result: messageContent,
          parsedJson,
          model,
          usage: {
            prompt_tokens: response.data.usage?.prompt_tokens,
            completion_tokens: response.data.usage?.completion_tokens,
            total_tokens: response.data.usage?.total_tokens,
            total_time: response.data.usage?.total_time,
          },
        };
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          const errorData = error.response?.data as { error?: { message?: string } } | undefined;
          lastErrorDetail = errorData?.error?.message || error.message;

          const isDecommissionedOrNotFound =
            lastErrorDetail.includes('does not exist') ||
            lastErrorDetail.includes('do not have access') ||
            lastErrorDetail.includes('decommissioned') ||
            lastErrorDetail.includes('no longer supported') ||
            lastErrorDetail.includes('model_not_found') ||
            error.response?.status === 404 ||
            error.response?.status === 400;

          if (!isDecommissionedOrNotFound) {
            throw new AppError(`Erro na consulta de IA com Groq: ${lastErrorDetail}`, 502);
          }
        } else if (error instanceof Error) {
          lastErrorDetail = error.message;
        }
      }
    }

    throw new AppError(
      `Erro na consulta de IA com Groq: Nenhum dos modelos ativos respondeu. Último erro: ${lastErrorDetail}`,
      502
    );
  }

  /**
   * Busca produto no catálogo com tolerância a variações semânticas e termos falados.
   */
  private async findProductByQuery(query: string, tenantId: string) {
    const cleanQuery = query.trim().toLowerCase();

    // 1. Busca exata por código de barras ou nome
    const exactMatch = await prisma.product.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { barcode: query },
          { name: { equals: query, mode: 'insensitive' } },
        ],
      },
    });

    if (exactMatch) return exactMatch;

    // 2. Busca por substring
    const containsMatch = await prisma.product.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        name: { contains: query, mode: 'insensitive' },
      },
    });

    // 3. Busca por tokens chave
    const tokens = cleanQuery
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z0-9]/gi, ''))
      .filter((t) => t.length > 1 && !STOPWORDS[t]);

    if (tokens.length > 0) {
      const products = await prisma.product.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: tokens.map((token) => ({
            name: { contains: token, mode: 'insensitive' },
          })),
        },
        take: 10,
      });

      if (products.length > 0) {
        let bestProduct = products[0];
        let maxScore = -1;

        for (const prod of products) {
          const prodName = prod.name.toLowerCase();
          let score = 0;
          for (const token of tokens) {
            if (prodName.includes(token)) {
              score += token.length;
            }
          }
          if (score > maxScore) {
            maxScore = score;
            bestProduct = prod;
          }
        }

        if (maxScore > 0) {
          return bestProduct;
        }
      }
    }

    return null;
  }

  /**
   * Processa comando de voz ou texto de chão de loja com suporte completo a múltiplos produtos e multi-ações.
   */
  async processVoiceCommand(
    audioBuffer: Buffer | null,
    filename: string,
    user: AuthUser,
    options?: { systemPrompt?: string; autoExecute?: boolean; prompt?: string }
  ) {
    let transcription = options?.prompt?.trim() || '';

    // 1. Transcrição Whisper se áudio fornecido e nenhum prompt de texto direto
    if (!transcription && audioBuffer && audioBuffer.length > 0) {
      const transcribeResult = await this.transcribeAudio({
        audioBuffer,
        filename,
      });
      transcription = transcribeResult.text || '';
    }

    if (!transcription.trim()) {
      return {
        transcription: '',
        intent: 'UNKNOWN' as const,
        extractedData: {},
        actions: [],
        matchedProducts: [],
        explanation: 'Nenhum comando em áudio ou texto foi detectado.',
        executed: false,
      };
    }
    const systemPrompt =
      options?.systemPrompt ||
      `Você é o assistente de inteligência artificial de estoque do GO PME.
Sua missão é classificar a intenção do operador em um modelo universal e paramétrico:

IMPORTANTE SOBRE QUANTIDADES:
- Quantidades de produtos em estoque DEVEM ser SEMPRE números inteiros (arredondados).
- Suporte a porcentagens: Quando o usuário disser "transfere 50% de cada produto", "move 30% da gôndola", "reponha 20% das bebidas", defina "quantityRule": "PERCENTAGE" e "percentage": 50 (ou o valor correspondente de 1 a 100).

Classifique se a frase se refere a:
1. "isBatch": true -> Operação em lote/escopo amplo (toda a loja, categoria inteira, gôndolas críticas ou percentual).
   Exemplos:
   - "Transfere 50% de cada produto pra gôndola" / "Move metade do depósito pra gôndola":
     -> isBatch: true, batchConfig: { operation: "TRANSFER", scope: "ALL", from: "depot", to: "shelf", quantityRule: "PERCENTAGE", percentage: 50 }
   - "Transfere 25% de todas as bebidas pro salão":
     -> isBatch: true, batchConfig: { operation: "TRANSFER", scope: "CATEGORY", category: "Bebidas", from: "depot", to: "shelf", quantityRule: "PERCENTAGE", percentage: 25 }
   - "Faz uma varredura no estoque e repõe o que tá faltando na gôndola" / "Repõe tudo que tá crítico":
     -> isBatch: true, batchConfig: { operation: "TRANSFER", scope: "CRITICAL_ONLY", from: "depot", to: "shelf", quantityRule: "DEFICIT" }
   - "Guarda tudo da gôndola no depósito":
     -> isBatch: true, batchConfig: { operation: "TRANSFER", scope: "ALL", from: "shelf", to: "depot", quantityRule: "ALL" }
   - "Transfere 10 unidades de todas as bebidas pro salão/gôndola":
     -> isBatch: true, batchConfig: { operation: "TRANSFER", scope: "CATEGORY", category: "Bebidas", from: "depot", to: "shelf", quantityRule: "EXACT", quantityValue: 10 }

2. "isBatch": false -> Ações diretas sobre produtos unitários ou múltiplos produtos nomeados.
   Exemplos:
   - "Transfere 2 Guaraná Antarctica zero pra gôndola":
     -> isBatch: false, directActions: [{ action: "TRANSFER_STOCK", productQuery: "Guaraná Antarctica zero", quantity: 2, from: "depot", to: "shelf", destination: "shelf" }]
   - "Vendi 3 leites condensados no dinheiro":
     -> isBatch: false, directActions: [{ action: "POS_SALE", productQuery: "leite condensado", quantity: 3 }]
   - "Muda o preço da Coca Cola 2L para 10.50":
     -> isBatch: false, directActions: [{ action: "UPDATE_PRODUCT", productQuery: "Coca Cola 2L", price: 10.50 }]

Você DEVE responder ESTRITAMENTE em formato JSON:
{
  "isBatch": boolean,
  "batchConfig": {
    "operation": "TRANSFER" | "UPDATE_PRICE" | "STOCK_ENTRY",
    "scope": "ALL" | "CRITICAL_ONLY" | "CATEGORY" | "SPECIFIC",
    "category": string | null,
    "from": "depot" | "shelf" | null,
    "to": "depot" | "shelf" | null,
    "quantityRule": "DEFICIT" | "ALL" | "EXACT" | "PERCENTAGE",
    "quantityValue": number | null,
    "percentage": number | null,
    "newPrice": number | null
  },
  "directActions": [
    {
      "action": "TRANSFER_STOCK" | "STOCK_ENTRY" | "UPDATE_PRODUCT" | "POS_SALE" | "REGISTER_PRODUCT" | "CHECK_STOCK",
      "productQuery": string,
      "quantity": number | null,
      "price": number | null,
      "from": "depot" | "shelf" | null,
      "to": "depot" | "shelf" | null,
      "destination": "depot" | "shelf" | null
    }
  ],
  "explanation": "Explicação em português simples e claro do que foi compreendido"
}`;
    const chatResult = await this.chatPrompt({
      prompt: `Texto transcrito pelo operador: "${transcription}"`,
      systemPrompt,
      temperature: 0.0,
      jsonMode: true,
    });

    const parsed = (chatResult.parsedJson as ParsedUniversalVoiceResponse) || {};
    const normalizedTranscription = transcription.toLowerCase();
    const isScanCommand =
      normalizedTranscription.includes('varredura') ||
      normalizedTranscription.includes('todos os produtos') ||
      normalizedTranscription.includes('todas as gondolas') ||
      normalizedTranscription.includes('todas as gôndolas') ||
      normalizedTranscription.includes('tudo que tiver') ||
      normalizedTranscription.includes('repor estoque') ||
      normalizedTranscription.includes('menor do que a minima') ||
      normalizedTranscription.includes('menor do que a mínima');

    const isBatch = parsed.isBatch ?? isScanCommand;
    const batchConfig = parsed.batchConfig || {
      operation: 'TRANSFER' as const,
      scope: isScanCommand ? ('CRITICAL_ONLY' as const) : ('ALL' as const),
      from: 'depot' as const,
      to: 'shelf' as const,
      quantityRule: isScanCommand ? ('DEFICIT' as const) : ('ALL' as const),
    };

    const actionList: ActionItem[] = [];
    const matchedProductsMap = new Map<string, MatchedProductSummary>();
    const executedResults: unknown[] = [];
    let explanation = parsed.explanation || 'Comando interpretado com sucesso.';
    let intent: VoiceIntent = 'UNKNOWN';

    // 3. Resolução Dinâmica (Batch vs Direto)
    if (isBatch && user.tenantId) {
      const whereClause: { tenantId: string; deletedAt: null; category?: { contains: string; mode: 'insensitive' } } = {
        tenantId: user.tenantId,
        deletedAt: null,
      };

      if (batchConfig.category) {
        whereClause.category = { contains: batchConfig.category, mode: 'insensitive' };
      }

      const products = await prisma.product.findMany({
        where: whereClause,
        orderBy: { name: 'asc' },
      });

      const fromLocation = batchConfig.from || 'depot';
      const toLocation = batchConfig.to || 'shelf';
      const rule = batchConfig.quantityRule || 'DEFICIT';

      for (const prod of products) {
        let calculatedQty = 0;

        if (batchConfig.scope === 'CRITICAL_ONLY' || rule === 'DEFICIT') {
          if (prod.shelfQty <= prod.shelfMinQty && prod.depotQty > 0) {
            calculatedQty = Math.floor(Math.min(Math.max(1, prod.shelfMinQty - prod.shelfQty), prod.depotQty));
          }
        } else if (rule === 'PERCENTAGE') {
          const pct = Number(batchConfig.percentage || 0);
          const validPct = Math.min(Math.max(1, pct), 100);
          const available = fromLocation === 'shelf' ? prod.shelfQty : prod.depotQty;
          calculatedQty = Math.round((available * validPct) / 100);
          // Se houver saldo e o arredondamento der 0, transfere no mínimo 1 se o percentual for > 0
          if (calculatedQty === 0 && available > 0 && validPct > 0) {
            calculatedQty = 1;
          }
        } else if (rule === 'ALL') {
          calculatedQty = fromLocation === 'shelf' ? prod.shelfQty : prod.depotQty;
        } else if (rule === 'EXACT' && batchConfig.quantityValue) {
          const available = fromLocation === 'shelf' ? prod.shelfQty : prod.depotQty;
          calculatedQty = Math.floor(Math.min(Math.max(1, Number(batchConfig.quantityValue)), available));
        }
        calculatedQty = Math.floor(Math.max(0, calculatedQty));

        if (calculatedQty > 0) {
          const summary: MatchedProductSummary = {
            id: prod.id,
            name: prod.name,
            barcode: prod.barcode,
            price: prod.price ? Number(prod.price) : null,
            depotQty: prod.depotQty,
            shelfQty: prod.shelfQty,
          };

          actionList.push({
            action: 'TRANSFER_STOCK',
            productQuery: prod.name,
            quantity: calculatedQty,
            from: fromLocation,
            to: toLocation,
            destination: toLocation,
            matchedProduct: summary,
          });

          matchedProductsMap.set(prod.id, summary);
        }
      }

      if (actionList.length === 0) {
        explanation =
          batchConfig.scope === 'CRITICAL_ONLY' || rule === 'DEFICIT'
            ? 'Varredura concluída: Nenhuma gôndola está abaixo do mínimo ou não há saldo no depósito para repor.'
            : 'Nenhum produto atendeu aos critérios para movimentação em lote ou o saldo no local de origem está zerado.';
      } else {
        explanation = `Operação em lote preparada: ${actionList.length} produto(s) selecionado(s) para movimentação (${fromLocation === 'depot' ? 'Depósito -> Gôndola' : 'Gôndola -> Depósito'}).`;
      }

      intent = batchConfig.scope === 'CRITICAL_ONLY' || rule === 'DEFICIT' ? 'REPLENISH_ALL_CRITICAL' : 'TRANSFER_STOCK';
    } else {
      // Ações Diretas
      const directActions = parsed.directActions && parsed.directActions.length > 0 ? parsed.directActions : [];

      for (const item of directActions) {
        const actionType = item.action || 'TRANSFER_STOCK';
        const resolvedDestination = item.destination || item.to || (item.from === 'shelf' ? 'depot' : 'shelf');
        const isToDepot = resolvedDestination === 'depot' || item.to === 'depot' || item.from === 'shelf';
        const rawQty = item.quantity !== undefined && item.quantity !== null ? Number(item.quantity) : undefined;
        const intQty = rawQty !== undefined ? Math.floor(Math.max(1, Math.round(rawQty))) : undefined;

        actionList.push({
          action: actionType,
          productQuery: item.productQuery || undefined,
          quantity: intQty,
          price: item.price !== undefined && item.price !== null ? Number(item.price) : undefined,
          from: item.from || (isToDepot ? 'shelf' : 'depot'),
          to: item.to || (isToDepot ? 'depot' : 'shelf'),
          destination: resolvedDestination,
        });
      }

      if (actionList.length === 1) {
        intent = actionList[0].action as VoiceIntent;
      } else if (actionList.length > 1) {
        intent = 'COMPOUND_ACTION';
      } else {
        intent = 'UNKNOWN';
      }
    }

    // Localiza produtos nas ações diretas (se ainda não vinculados)
    if (user.tenantId) {
      for (const item of actionList) {
        if (!item.matchedProduct && item.productQuery) {
          const found = await this.findProductByQuery(item.productQuery, user.tenantId);
          if (found) {
            const summary: MatchedProductSummary = {
              id: found.id,
              name: found.name,
              barcode: found.barcode,
              price: found.price ? Number(found.price) : null,
              depotQty: found.depotQty,
              shelfQty: found.shelfQty,
            };
            item.matchedProduct = summary;
            matchedProductsMap.set(found.id, summary);
          }
        }
      }
    }

    // Execução automática para cada produto e ação
    if (options?.autoExecute && user.tenantId && actionList.length > 0) {
      for (const item of actionList) {
        const targetProduct = item.matchedProduct
          ? await prisma.product.findFirst({ where: { id: item.matchedProduct.id, deletedAt: null } })
          : item.productQuery
          ? await this.findProductByQuery(item.productQuery, user.tenantId)
          : null;

        if (item.action === 'STOCK_ENTRY' && item.quantity) {
          const qty = Math.floor(Math.max(1, Math.round(Number(item.quantity))));
          const destination = item.destination || 'depot';

          if (targetProduct) {
            const updated = await prisma.product.update({
              where: { id: targetProduct.id },
              data: {
                depotQty: destination === 'depot' ? targetProduct.depotQty + qty : targetProduct.depotQty,
                shelfQty: destination === 'shelf' ? targetProduct.shelfQty + qty : targetProduct.shelfQty,
              },
            });
            item.executed = true;
            item.result = {
              message: `Estoque de ${targetProduct.name} atualizado: +${qty} un no ${destination === 'depot' ? 'Depósito' : 'Gôndola'}. Novo saldo: ${destination === 'depot' ? updated.depotQty : updated.shelfQty} un.`,
              product: updated,
            };
            executedResults.push(item.result);
          } else if (item.productQuery) {
            const generatedBarcode = item.barcode || `AUTO-${Date.now().toString().slice(-8)}`;
            const newProduct = await productService.create(
              {
                name: item.productQuery,
                barcode: generatedBarcode,
                depotQty: destination === 'depot' ? qty : 0,
                shelfQty: destination === 'shelf' ? qty : 0,
                shelfMinQty: 5,
                price: item.price ? Number(item.price) : undefined,
              },
              user
            );
            item.executed = true;
            item.result = {
              message: `Novo produto cadastrado: ${newProduct.product.name} com ${qty} un no ${destination === 'depot' ? 'Depósito' : 'Gôndola'}.`,
              product: newProduct.product,
            };
            executedResults.push(item.result);
          }
        } else if (item.action === 'REGISTER_PRODUCT' && item.productQuery) {
          const generatedBarcode = item.barcode || `AUTO-${Date.now().toString().slice(-8)}`;
          const initialDepot = item.depotQty !== undefined ? Math.floor(Math.max(0, Number(item.depotQty))) : item.quantity ? Math.floor(Math.max(0, Number(item.quantity))) : 0;
          const initialShelf = item.shelfQty !== undefined ? Math.floor(Math.max(0, Number(item.shelfQty))) : 0;

          if (targetProduct) {
            const updated = await prisma.product.update({
              where: { id: targetProduct.id },
              data: {
                depotQty: initialDepot > 0 ? targetProduct.depotQty + initialDepot : targetProduct.depotQty,
                shelfQty: initialShelf > 0 ? targetProduct.shelfQty + initialShelf : targetProduct.shelfQty,
                price: item.price ? Number(item.price) : targetProduct.price,
              },
            });
            item.executed = true;
            item.result = {
              message: `Produto existente ${targetProduct.name} atualizado com as quantidades informadas.`,
              product: updated,
            };
            executedResults.push(item.result);
          } else {
            const newProduct = await productService.create(
              {
                name: item.productQuery,
                barcode: generatedBarcode,
                depotQty: initialDepot,
                shelfQty: initialShelf,
                shelfMinQty: 5,
                price: item.price ? Number(item.price) : undefined,
              },
              user
            );
            item.executed = true;
            item.result = {
              message: `Produto ${newProduct.product.name} cadastrado com sucesso (${initialDepot} un no depósito e ${initialShelf} un na gôndola).`,
              product: newProduct.product,
            };
            executedResults.push(item.result);
          }
        } else if (item.action === 'UPDATE_PRODUCT' && targetProduct) {
          const effectivePrice = item.price;
          const updatePayload: {
            price?: number;
            depotLocation?: string;
            shelfLocation?: string;
            shelfMinQty?: number;
          } = {};

          if (effectivePrice !== undefined && effectivePrice !== null) {
            updatePayload.price = Number(effectivePrice);
          }
          if (item.depotLocation) {
            updatePayload.depotLocation = item.depotLocation;
          }
          if (item.shelfLocation) {
            updatePayload.shelfLocation = item.shelfLocation;
          }
          if (item.shelfMinQty !== undefined && item.shelfMinQty !== null) {
            updatePayload.shelfMinQty = Math.floor(Math.max(0, Number(item.shelfMinQty)));
          }

          const updated = await productService.update(targetProduct.id, updatePayload, user);
          item.executed = true;
          item.result = {
            message: `Produto ${targetProduct.name} atualizado com sucesso.`,
            product: updated.product,
          };
          executedResults.push(item.result);
        } else if (item.action === 'TRANSFER_STOCK' && targetProduct && item.quantity) {
          const qty = Math.floor(Math.max(1, Math.round(Number(item.quantity))));
          const resolvedDestination = item.destination || item.to || (item.from === 'shelf' ? 'depot' : 'shelf');
          const isToDepot = resolvedDestination === 'depot' || item.to === 'depot' || item.from === 'shelf';

          let updatedProd;
          if (isToDepot && (item.from === 'shelf' || item.to === 'depot')) {
            if (targetProduct.shelfQty < qty) {
              throw new AppError(
                `Estoque insuficiente na gôndola para transferir ao depósito. Gôndola de "${targetProduct.name}" possui ${targetProduct.shelfQty} un.`,
                400
              );
            }
            updatedProd = await prisma.product.update({
              where: { id: targetProduct.id },
              data: {
                shelfQty: targetProduct.shelfQty - qty,
                depotQty: targetProduct.depotQty + qty,
              },
            });
          } else {
            const transferRes = await productService.transferStock(targetProduct.id, qty, user);
            updatedProd = transferRes.product;
          }

          item.executed = true;
          item.result = {
            message: `Transferência de ${qty} un de ${targetProduct.name} (${isToDepot ? 'Gôndola -> Depósito' : 'Depósito -> Gôndola'}) concluída.`,
            product: updatedProd,
          };
          executedResults.push(item.result);
        } else if (item.action === 'CHECK_STOCK' && targetProduct) {
          item.executed = true;
          item.result = { product: targetProduct };
          executedResults.push(item.result);
        }
      }
    }

    return {
      transcription,
      intent,
      extractedData: {
        isBatch,
        batchConfig,
        rawParsed: parsed,
      },
      actions: actionList,
      matchedProducts: Array.from(matchedProductsMap.values()),
      explanation,
      executed: executedResults.length > 0,
      executionResult:
        executedResults.length === 1
          ? executedResults[0]
          : executedResults.length > 1
          ? executedResults
          : undefined,
    };
  }
}

export const groqService = new GroqService();
