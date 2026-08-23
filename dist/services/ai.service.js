import axios from 'axios';
import { AppError } from '../errors/app-error.js';
import { productService } from './product.service.js';
import { prisma } from '../lib/prisma.js';
const STOPWORDS = {
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
};
export class GroqService {
    getApiKey() {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new AppError('A chave de API da Groq (GROQ_API_KEY) não está configurada no ambiente (.env).', 500);
        }
        return apiKey;
    }
    getBaseUrl() {
        return process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
    }
    /**
     * Consulta a API da Groq em tempo real para obter a lista de modelos ativos na conta.
     */
    async listAvailableModels() {
        const apiKey = this.getApiKey();
        const baseUrl = this.getBaseUrl();
        try {
            const response = await axios.get(`${baseUrl}/models`, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            });
            return response.data.data || [];
        }
        catch (error) {
            let detail = 'Falha ao listar modelos do Groq';
            if (axios.isAxiosError(error)) {
                const errorData = error.response?.data;
                detail = errorData?.error?.message || error.message;
            }
            else if (error instanceof Error) {
                detail = error.message;
            }
            throw new AppError(`Erro ao consultar modelos disponíveis na Groq: ${detail}`, 502);
        }
    }
    /**
     * Obtém dinamicamente o melhor modelo de chat disponível na conta.
     */
    async resolveChatModels(requestedModel) {
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
                .filter((id) => !id.includes('whisper') &&
                !id.includes('guard') &&
                !id.includes('embedding'));
            if (chatModelIds.length > 0) {
                const sorted = [...chatModelIds].sort((a, b) => {
                    const priority = (id) => {
                        if (id.includes('70b') || id.includes('llama-3.3'))
                            return 1;
                        if (id.includes('8b') || id.includes('instant'))
                            return 2;
                        if (id.includes('qwen') || id.includes('gemma'))
                            return 3;
                        return 4;
                    };
                    return priority(a) - priority(b);
                });
                return sorted;
            }
        }
        catch {
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
    async transcribeAudio(options) {
        const apiKey = this.getApiKey();
        const baseUrl = this.getBaseUrl();
        const filename = options.filename || 'audio.m4a';
        const language = options.language || 'pt';
        const prompt = options.prompt ||
            'Vocabulário de varejo brasileiro: gôndola, depósito, reposição, compra, entrada de mercadoria, estoque, preço, reajuste, transferência, caixa, EAN, fardo, pacote, unidade, Pepsi Twist, Guaraná Zero, Coca-Cola, refrigerante, cerveja, leite, arroz, feijão.';
        const ext = filename.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'mp3'
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
                const response = await axios.post(`${baseUrl}/audio/transcriptions`, formData, {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                    },
                });
                return {
                    text: response.data.text || '',
                    model,
                    duration: response.data.duration,
                };
            }
            catch (error) {
                if (axios.isAxiosError(error)) {
                    const errorData = error.response?.data;
                    lastErrorDetail = errorData?.error?.message || error.message;
                }
                else if (error instanceof Error) {
                    lastErrorDetail = error.message;
                }
            }
        }
        throw new AppError(`Erro ao transcrever áudio com Groq Whisper: ${lastErrorDetail}`, 502);
    }
    /**
     * Executa inferência com chat completions descobrindo modelos ativos dinamicamente.
     */
    async chatPrompt(options) {
        const apiKey = this.getApiKey();
        const baseUrl = this.getBaseUrl();
        const candidateModels = await this.resolveChatModels(options.model);
        const messages = [];
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
            const payload = {
                model,
                messages,
                temperature: options.temperature ?? 0.1,
            };
            if (options.jsonMode) {
                payload.response_format = { type: 'json_object' };
            }
            try {
                const response = await axios.post(`${baseUrl}/chat/completions`, payload, {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                });
                const messageContent = response.data.choices?.[0]?.message?.content || '';
                let parsedJson = null;
                if (options.jsonMode) {
                    try {
                        parsedJson = JSON.parse(messageContent);
                    }
                    catch {
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
            }
            catch (error) {
                if (axios.isAxiosError(error)) {
                    const errorData = error.response?.data;
                    lastErrorDetail = errorData?.error?.message || error.message;
                    const isDecommissionedOrNotFound = lastErrorDetail.includes('does not exist') ||
                        lastErrorDetail.includes('do not have access') ||
                        lastErrorDetail.includes('decommissioned') ||
                        lastErrorDetail.includes('no longer supported') ||
                        lastErrorDetail.includes('model_not_found') ||
                        error.response?.status === 404 ||
                        error.response?.status === 400;
                    if (!isDecommissionedOrNotFound) {
                        throw new AppError(`Erro na consulta de IA com Groq: ${lastErrorDetail}`, 502);
                    }
                }
                else if (error instanceof Error) {
                    lastErrorDetail = error.message;
                }
            }
        }
        throw new AppError(`Erro na consulta de IA com Groq: Nenhum dos modelos ativos respondeu. Último erro: ${lastErrorDetail}`, 502);
    }
    /**
     * Busca produto com tolerância semântica a variações de nome falado (Fuzzy / Token matching).
     */
    async findProductByQuery(query, tenantId) {
        const cleanQuery = query.trim().toLowerCase();
        // 1. Busca exata por código de barras ou nome
        const exactMatch = await prisma.product.findFirst({
            where: {
                tenantId,
                OR: [
                    { barcode: query },
                    { name: { equals: query, mode: 'insensitive' } },
                ],
            },
        });
        if (exactMatch)
            return exactMatch;
        // 2. Busca por substring (contains)
        const containsMatch = await prisma.product.findFirst({
            where: {
                tenantId,
                name: { contains: query, mode: 'insensitive' },
            },
        });
        if (containsMatch)
            return containsMatch;
        // 3. Busca por tokens/palavras-chave (ignora preposições e pronomes)
        const tokens = cleanQuery
            .split(/\s+/)
            .map((t) => t.replace(/[^a-z0-9]/gi, ''))
            .filter((t) => t.length > 1 && !STOPWORDS[t]);
        if (tokens.length > 0) {
            const products = await prisma.product.findMany({
                where: {
                    tenantId,
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
     * Processa comando de voz de chão de loja com suporte a ações compostas / multi-comandos.
     */
    async processVoiceCommand(audioBuffer, filename, user, options) {
        // 1. Transcrição Whisper
        const { text: transcription } = await this.transcribeAudio({
            audioBuffer,
            filename,
        });
        if (!transcription.trim()) {
            return {
                transcription: '',
                intent: 'UNKNOWN',
                extractedData: {},
                explanation: 'Nenhuma fala ou áudio inteligível foi detectado.',
                executed: false,
            };
        }
        // 2. Extração semântica com suporte a comandos compostos (Ex: Mudar preço E transferir)
        const systemPrompt = options?.systemPrompt ||
            `Você é o assistente de inteligência artificial do sistema de varejo e estoque GO PME.
Sua missão é analisar a fala do operador e extrair as intenções e ações operacionais a serem executadas no sistema.
ATENÇÃO: O usuário pode solicitar UMA OU MÚLTIPLAS AÇÕES na mesma frase (ex: "Quero mudar o preço da Pepsi Twist para 12 reais e também transferir 12 unidades da gôndola para o depósito").

Ações suportadas:
1. "UPDATE_PRODUCT": Alterar preço de venda, localização ou estoque mínimo de produto. (Ex: "preço seja R$ 12,00", "muda o preço para 8.50", "coloca no corredor 2").
2. "TRANSFER_STOCK": Movimentação entre depósito e gôndola (tanto Depósito -> Gôndola quanto Gôndola -> Depósito).
3. "STOCK_ENTRY": Entrada de novas mercadorias / compra de fornecedor (soma ao estoque).
4. "POS_SALE": Venda rápida no caixa / PDV.
5. "CHECK_STOCK": Consulta de estoque / preço.
6. "REGISTER_PRODUCT": Cadastro formal de produto.

Regras de classificação:
- Se houver apenas 1 ação, defina "intent" com o nome da ação.
- Se houver 2 ou mais ações (ex: atualizar preço E transferir estoque), defina "intent": "COMPOUND_ACTION" e liste cada ação detalhada dentro da lista "actions".
- IMPORTANTE: Sempre preencha o campo "price" com o valor numérico mencionado (ex: se o usuário disser "preço seja R$ 12,00", preencha "price": 12.00 e "newPrice": 12.00).

Você DEVE responder ESTRITAMENTE em formato JSON:
{
  "intent": "UPDATE_PRODUCT" | "TRANSFER_STOCK" | "STOCK_ENTRY" | "POS_SALE" | "CHECK_STOCK" | "REGISTER_PRODUCT" | "COMPOUND_ACTION" | "UNKNOWN",
  "extractedData": {
    "productQuery": string ou null (nome do produto ou código de barras mencionado),
    "price": number ou null (preço informado em valor numérico, ex: 12.00),
    "newPrice": number ou null (novo preço quando for atualização, ex: 12.00),
    "quantity": number ou null (quantidade mencionada),
    "from": "depot" | "shelf" ou null (origem da transferência),
    "to": "depot" | "shelf" ou null (destino da transferência),
    "destination": "depot" | "shelf" ou null,
    "depotLocation": string ou null,
    "shelfLocation": string ou null,
    "shelfMinQty": number ou null,
    "barcode": string ou null
  },
  "actions": [
    {
      "action": "UPDATE_PRODUCT" | "TRANSFER_STOCK" | "STOCK_ENTRY" | "POS_SALE" | "CHECK_STOCK" | "REGISTER_PRODUCT",
      "productQuery": string ou null,
      "price": number ou null,
      "quantity": number ou null,
      "from": "depot" | "shelf" ou null,
      "to": "depot" | "shelf" ou null,
      "destination": "depot" | "shelf" ou null
    }
  ],
  "explanation": "Resumo amigável em português explicando todas as ações que serão realizadas"
}`;
        const chatResult = await this.chatPrompt({
            prompt: `Texto transcrito pelo operador: "${transcription}"`,
            systemPrompt,
            temperature: 0.0,
            jsonMode: true,
        });
        const parsed = chatResult.parsedJson || {};
        const intent = (parsed.intent || 'UNKNOWN');
        const extractedData = parsed.extractedData || {};
        const explanation = parsed.explanation || 'Comando interpretado com sucesso.';
        // Normaliza os campos price e newPrice caso o LLM tenha preenchido apenas um deles
        const resolvedPrice = extractedData.price !== undefined && extractedData.price !== null
            ? Number(extractedData.price)
            : extractedData.newPrice !== undefined && extractedData.newPrice !== null
                ? Number(extractedData.newPrice)
                : undefined;
        if (resolvedPrice !== undefined) {
            extractedData.price = resolvedPrice;
            extractedData.newPrice = resolvedPrice;
        }
        // Normaliza a lista de ações a executar
        const rawActions = parsed.actions && parsed.actions.length > 0 ? parsed.actions : [];
        const actionList = rawActions.length > 0
            ? rawActions.map((act) => ({
                ...act,
                price: act.price !== undefined && act.price !== null
                    ? Number(act.price)
                    : act.action === 'UPDATE_PRODUCT'
                        ? resolvedPrice
                        : undefined,
            }))
            : intent !== 'UNKNOWN' && intent !== 'COMPOUND_ACTION'
                ? [
                    {
                        action: intent,
                        productQuery: extractedData.productQuery,
                        price: resolvedPrice,
                        quantity: extractedData.quantity,
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
        let matchedProduct = null;
        // Busca produto principal
        const mainQuery = extractedData.productQuery || actionList[0]?.productQuery;
        if (user.tenantId && mainQuery) {
            const found = await this.findProductByQuery(mainQuery, user.tenantId);
            if (found) {
                matchedProduct = {
                    id: found.id,
                    name: found.name,
                    barcode: found.barcode,
                    price: found.price,
                    depotQty: found.depotQty,
                    shelfQty: found.shelfQty,
                };
            }
        }
        const executedResults = [];
        let allExecuted = false;
        // Execução automática de cada ação
        if (options?.autoExecute && user.tenantId && actionList.length > 0) {
            for (const item of actionList) {
                const productQuery = item.productQuery || mainQuery;
                const targetProduct = productQuery
                    ? await this.findProductByQuery(productQuery, user.tenantId)
                    : matchedProduct ? await prisma.product.findUnique({ where: { id: matchedProduct.id } }) : null;
                const effectivePrice = item.price ?? resolvedPrice;
                if (item.action === 'UPDATE_PRODUCT' && targetProduct) {
                    const updatePayload = {};
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
                        message: `Preço/dados de ${targetProduct.name} atualizados com sucesso (Novo preço: R$ ${effectivePrice ? Number(effectivePrice).toFixed(2) : updated.product.price}).`,
                        product: updated.product,
                    };
                    executedResults.push(item.result);
                }
                else if (item.action === 'TRANSFER_STOCK' && targetProduct && item.quantity) {
                    const qty = Number(item.quantity);
                    const from = item.from || 'shelf';
                    const to = item.to || 'depot';
                    let updatedProd;
                    if (from === 'shelf' && to === 'depot') {
                        if (targetProduct.shelfQty < qty) {
                            throw new AppError(`Estoque insuficiente na gôndola para transferir ao depósito. Gôndola possui ${targetProduct.shelfQty} un.`, 400);
                        }
                        updatedProd = await prisma.product.update({
                            where: { id: targetProduct.id },
                            data: {
                                shelfQty: targetProduct.shelfQty - qty,
                                depotQty: targetProduct.depotQty + qty,
                            },
                        });
                    }
                    else {
                        const transferRes = await productService.transferStock(targetProduct.id, qty, user);
                        updatedProd = transferRes.product;
                    }
                    item.executed = true;
                    item.result = {
                        message: `Transferência de ${qty} un de ${targetProduct.name} (${from === 'shelf' ? 'Gôndola -> Depósito' : 'Depósito -> Gôndola'}) concluída.`,
                        product: updatedProd,
                    };
                    executedResults.push(item.result);
                }
                else if (item.action === 'STOCK_ENTRY' && item.quantity) {
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
                            message: `Entrada de estoque: +${qty} un adicionadas ao ${destination === 'depot' ? 'Depósito' : 'Gôndola'} de ${targetProduct.name}.`,
                            product: updated,
                        };
                        executedResults.push(item.result);
                    }
                    else if (productQuery) {
                        const generatedBarcode = item.barcode || `AUTO-${Date.now().toString().slice(-8)}`;
                        const newProduct = await productService.create({
                            name: productQuery,
                            barcode: generatedBarcode,
                            depotQty: destination === 'depot' ? qty : 0,
                            shelfQty: destination === 'shelf' ? qty : 0,
                            shelfMinQty: 5,
                            price: effectivePrice ? Number(effectivePrice) : undefined,
                        }, user);
                        item.executed = true;
                        item.result = {
                            message: `Novo produto cadastrado: ${newProduct.product.name} com ${qty} un no ${destination === 'depot' ? 'Depósito' : 'Gôndola'}.`,
                            product: newProduct.product,
                        };
                        executedResults.push(item.result);
                    }
                }
            }
            allExecuted = executedResults.length > 0;
        }
        return {
            transcription,
            intent,
            extractedData,
            actions: actionList,
            matchedProduct: matchedProduct
                ? {
                    id: matchedProduct.id,
                    name: matchedProduct.name,
                    barcode: matchedProduct.barcode,
                    price: matchedProduct.price ? Number(matchedProduct.price) : null,
                    depotQty: matchedProduct.depotQty,
                    shelfQty: matchedProduct.shelfQty,
                }
                : null,
            explanation,
            executed: allExecuted,
            executionResult: executedResults.length === 1
                ? executedResults[0]
                : executedResults.length > 1
                    ? executedResults
                    : undefined,
        };
    }
}
export const groqService = new GroqService();
