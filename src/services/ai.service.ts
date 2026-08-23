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

interface ParsedVoiceCommand {
  intent?: VoiceIntent;
  extractedData?: {
    productQuery?: string;
    quantity?: number;
    price?: number;
    newPrice?: number;
    destination?: 'depot' | 'shelf';
    from?: 'depot' | 'shelf';
    to?: 'depot' | 'shelf';
    paymentMethod?: 'MONEY' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX';
    barcode?: string;
    depotLocation?: string;
    shelfLocation?: string;
    shelfMinQty?: number;
  };
  actions?: ActionItem[];
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
   * Processa comando de voz de chão de loja com suporte completo a múltiplos produtos e multi-ações.
   */
  async processVoiceCommand(
    audioBuffer: Buffer,
    filename: string,
    user: AuthUser,
    options?: { systemPrompt?: string; autoExecute?: boolean }
  ) {
    // 1. Transcrição Whisper
    const { text: transcription } = await this.transcribeAudio({
      audioBuffer,
      filename,
    });

    if (!transcription.trim()) {
      return {
        transcription: '',
        intent: 'UNKNOWN' as const,
        extractedData: {},
        actions: [],
        matchedProducts: [],
        explanation: 'Nenhuma fala ou áudio inteligível foi detectado.',
        executed: false,
      };
    }

    // 2. Extração semântica com suporte explícito a múltiplos produtos
    const systemPrompt =
      options?.systemPrompt ||
      `Você é o assistente de inteligência artificial de estoque do GO PME.
Sua missão é identificar com precisão TODAS as ações e TODOS os produtos mencionados na frase do operador.

MUITO IMPORTANTE: A frase pode conter 1, 2 ou mais produtos diferentes com ações diferentes.
Exemplo: "Adiciona 50 unidades do produto Guaraná Antarctica Zero e cadastra o produto Guaraná Antarctica 2 litros. Ele tem 15 unidades no depósito e 5 na gôndola."
-> Neste exemplo, temos 2 produtos e 2 ações distintas:
   1) Ação "STOCK_ENTRY": productQuery="Guaraná Antarctica Zero", quantity=50, destination="depot" (ou entrada)
   2) Ação "REGISTER_PRODUCT": productQuery="Guaraná Antarctica 2 litros", depotQty=15, shelfQty=5

Ações suportadas por item:
- "REPLENISH_ALL_CRITICAL": Varredura geral do depósito para reposição em lote de gôndolas críticas. (Ex: "faça uma varredura no depósito", "reponha todas as gôndolas críticas", "transfere tudo que tá faltando na gôndola", "repor produtos críticos").
- "STOCK_ENTRY": Entrada/adição/compra de mercadorias no estoque. (Ex: "Adiciona 50 unidades de...", "Comprei 10 fardos de...").
- "REGISTER_PRODUCT": Cadastro de novo produto. (Ex: "cadastra o produto...", "novo produto com X no depósito e Y na gôndola").
- "UPDATE_PRODUCT": Atualização de preço, localização ou estoque mínimo. (Ex: "muda o preço para 12.00").
- "TRANSFER_STOCK": Transferência interna específica de produto (Depósito <-> Gôndola).
- "POS_SALE": Venda no caixa / PDV.
- "CHECK_STOCK": Consulta de saldo / preço.

Regras:
1. Se o comando for uma varredura geral ou reposição em lote de todos os produtos críticos (sem especificar um único produto), defina "intent": "REPLENISH_ALL_CRITICAL", actions: [] e explanation amigável.
2. Sempre gere a lista "actions" com uma entrada individual para CADA produto/ação mencionado.
3. Se houver mais de 1 ação na lista, defina "intent": "COMPOUND_ACTION". Se houver apenas 1, defina "intent" com o nome da respectiva ação.
4. Preencha os campos numéricos (quantity, price, depotQty, shelfQty) de cada ação individualmente.

Você DEVE responder ESTRITAMENTE em formato JSON:
{
  "intent": "UPDATE_PRODUCT" | "TRANSFER_STOCK" | "REPLENISH_ALL_CRITICAL" | "STOCK_ENTRY" | "POS_SALE" | "CHECK_STOCK" | "REGISTER_PRODUCT" | "COMPOUND_ACTION" | "UNKNOWN",
  "extractedData": {
    "productQuery": string ou null (primeiro produto mencionado ou resumo),
    "price": number ou null,
    "newPrice": number ou null,
    "quantity": number ou null,
    "depotQty": number ou null,
    "shelfQty": number ou null,
    "from": "depot" | "shelf" ou null,
    "to": "depot" | "shelf" ou null,
    "destination": "depot" | "shelf" ou null
  },
  "actions": [
    {
      "action": "UPDATE_PRODUCT" | "TRANSFER_STOCK" | "STOCK_ENTRY" | "POS_SALE" | "CHECK_STOCK" | "REGISTER_PRODUCT",
      "productQuery": string (nome exato deste produto),
      "price": number ou null,
      "quantity": number ou null,
      "depotQty": number ou null (quantidade no depósito quando for cadastro),
      "shelfQty": number ou null (quantidade na gôndola quando for cadastro),
      "from": "depot" | "shelf" ou null,
      "to": "depot" | "shelf" ou null,
      "destination": "depot" | "shelf" ou null
    }
  ],
  "explanation": "Resumo amigável em português explicando todas as ações que serão realizadas para cada produto"
}`;

    const chatResult = await this.chatPrompt({
      prompt: `Texto transcrito pelo operador: "${transcription}"`,
      systemPrompt,
      temperature: 0.0,
      jsonMode: true,
    });

    const parsed = (chatResult.parsedJson as ParsedVoiceCommand) || {};
    const intent = (parsed.intent || 'UNKNOWN') as VoiceIntent;
    const extractedData = parsed.extractedData || {};
    let explanation = parsed.explanation || 'Comando interpretado com sucesso.';
    // Normaliza os campos price e newPrice
    const resolvedPrice =
      extractedData.price !== undefined && extractedData.price !== null
        ? Number(extractedData.price)
        : extractedData.newPrice !== undefined && extractedData.newPrice !== null
        ? Number(extractedData.newPrice)
        : undefined;

    // Normaliza a lista de ações a executar
    const rawActions = parsed.actions && parsed.actions.length > 0 ? parsed.actions : [];
    const actionList: ActionItem[] =
      rawActions.length > 0
        ? rawActions.map((act) => ({
            ...act,
            price:
              act.price !== undefined && act.price !== null
                ? Number(act.price)
                : act.action === 'UPDATE_PRODUCT'
                ? resolvedPrice
                : undefined,
            depotQty:
              act.depotQty !== undefined && act.depotQty !== null
                ? Number(act.depotQty)
                : undefined,
            shelfQty:
              act.shelfQty !== undefined && act.shelfQty !== null
                ? Number(act.shelfQty)
                : undefined,
          }))
        : intent !== 'UNKNOWN' && intent !== 'COMPOUND_ACTION' && intent !== 'REPLENISH_ALL_CRITICAL'
        ? [
            {
              action: intent,
              productQuery: extractedData.productQuery,
              price: resolvedPrice,
              quantity: extractedData.quantity,
              depotQty: extractedData.depotLocation ? Number(extractedData.quantity) : undefined,
              shelfQty: extractedData.shelfLocation ? Number(extractedData.quantity) : undefined,
              from: extractedData.from,
              to: extractedData.to,
              destination: extractedData.destination,
              depotLocation: extractedData.depotLocation,
              shelfLocation: extractedData.shelfLocation,
              shelfMinQty: extractedData.shelfMinQty,
              barcode: extractedData.barcode,
              paymentMethod: extractedData.paymentMethod,
            },
          ]
        : [];

    const matchedProductsMap = new Map<string, MatchedProductSummary>();
    const executedResults: unknown[] = [];

    // Interceptador para varredura e reposição em lote de gôndolas críticas
    if (intent === 'REPLENISH_ALL_CRITICAL' && user.tenantId) {
      const activeProductsInDepot = await prisma.product.findMany({
        where: {
          tenantId: user.tenantId,
          deletedAt: null,
          depotQty: { gt: 0 },
        },
        orderBy: { name: 'asc' },
      });

      const criticalProducts = activeProductsInDepot.filter(
        (prod) => prod.shelfQty <= prod.shelfMinQty
      );

      actionList.length = 0; // Limpa lista prévia

      if (criticalProducts.length === 0) {
        explanation =
          'Varredura concluída: Nenhuma gôndola crítica necessita de reposição ou o depósito não possui estoque disponível no momento.';
      } else {
        explanation = `Varredura concluída: Identificamos ${criticalProducts.length} produto(s) com gôndola crítica prontos para reposição.`;

        for (const prod of criticalProducts) {
          const transferQty = Math.min(
            Math.max(1, prod.shelfMinQty - prod.shelfQty),
            prod.depotQty
          );

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
            quantity: transferQty,
            from: 'depot',
            to: 'shelf',
            destination: 'shelf',
            matchedProduct: summary,
          });

          matchedProductsMap.set(prod.id, summary);
        }
      }
    }

    // Localiza os produtos de cada ação
    if (user.tenantId) {
      for (const item of actionList) {
        if (item.productQuery) {
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
          const qty = Number(item.quantity);
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
          const initialDepot = item.depotQty !== undefined ? Number(item.depotQty) : item.quantity ? Number(item.quantity) : 0;
          const initialShelf = item.shelfQty !== undefined ? Number(item.shelfQty) : 0;

          if (targetProduct) {
            // Se já existir, atualiza as quantidades informadas
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
          const effectivePrice = item.price ?? resolvedPrice;
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
            updatePayload.shelfMinQty = Number(item.shelfMinQty);
          }

          const updated = await productService.update(targetProduct.id, updatePayload, user);
          item.executed = true;
          item.result = {
            message: `Produto ${targetProduct.name} atualizado com sucesso.`,
            product: updated.product,
          };
          executedResults.push(item.result);
        } else if (item.action === 'TRANSFER_STOCK' && targetProduct && item.quantity) {
          const qty = Number(item.quantity);
          const from = item.from || 'shelf';
          const to = item.to || 'depot';

          let updatedProd;
          if (from === 'shelf' && to === 'depot') {
            if (targetProduct.shelfQty < qty) {
              throw new AppError(
                `Estoque insuficiente na gôndola para transferir ao depósito. Gôndola possui ${targetProduct.shelfQty} un.`,
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
            message: `Transferência de ${qty} un de ${targetProduct.name} (${from === 'shelf' ? 'Gôndola -> Depósito' : 'Depósito -> Gôndola'}) concluída.`,
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
      extractedData,
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
