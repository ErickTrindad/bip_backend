import { groqService } from '../services/ai.service.js';
import { AppError } from '../errors/app-error.js';
import { groqTranscribeBodySchema, groqPromptBodySchema, groqVoiceCommandBodySchema, } from '../schemas/ai.schema.js';
export class AiController {
    /**
     * Lista modelos disponíveis na conta do Groq
     */
    async listModels(_request, reply) {
        try {
            const models = await groqService.listAvailableModels();
            return reply.status(200).send({ models });
        }
        catch (error) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao consultar modelos na Groq' });
        }
    }
    /**
     * Transcrição de áudio via JSON base64
     */
    async transcribe(request, reply) {
        const parseBody = groqTranscribeBodySchema.safeParse(request.body);
        if (!parseBody.success) {
            return reply.status(400).send({
                error: 'Dados inválidos para transcrição',
                details: parseBody.error.format(),
            });
        }
        try {
            const audioBuffer = Buffer.from(parseBody.data.audioBase64, 'base64');
            const result = await groqService.transcribeAudio({
                audioBuffer,
                filename: parseBody.data.filename,
                language: parseBody.data.language,
                prompt: parseBody.data.prompt,
                temperature: parseBody.data.temperature,
            });
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao processar transcrição de áudio' });
        }
    }
    /**
     * Transcrição de arquivo de áudio via multipart/form-data
     */
    async transcribeFile(request, reply) {
        try {
            const file = await request.file();
            if (!file) {
                return reply.status(400).send({ error: 'Nenhum arquivo de áudio enviado' });
            }
            const buffer = await file.toBuffer();
            const fields = file.fields;
            const language = fields.language?.value || 'pt';
            const prompt = fields.prompt?.value;
            const result = await groqService.transcribeAudio({
                audioBuffer: buffer,
                filename: file.filename,
                language,
                prompt,
            });
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao transcrever arquivo de áudio' });
        }
    }
    /**
     * Inferência e prompt com Llama
     */
    async chatPrompt(request, reply) {
        const parseBody = groqPromptBodySchema.safeParse(request.body);
        if (!parseBody.success) {
            return reply.status(400).send({
                error: 'Dados inválidos para consulta de IA',
                details: parseBody.error.format(),
            });
        }
        try {
            const result = await groqService.chatPrompt(parseBody.data);
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao processar consulta com Groq' });
        }
    }
    /**
     * Pipeline completo de Chão de Loja (Voz -> Whisper -> Llama -> Intenção + Ação Opcional)
     */
    async voiceCommand(request, reply) {
        const user = request.user;
        const parseBody = groqVoiceCommandBodySchema.safeParse(request.body);
        if (!parseBody.success) {
            return reply.status(400).send({
                error: 'Dados inválidos para comando de voz',
                details: parseBody.error.format(),
            });
        }
        try {
            const audioBuffer = Buffer.from(parseBody.data.audioBase64, 'base64');
            const result = await groqService.processVoiceCommand(audioBuffer, parseBody.data.filename, user, {
                systemPrompt: parseBody.data.systemPrompt,
                autoExecute: parseBody.data.autoExecute,
            });
            return reply.status(200).send(result);
        }
        catch (error) {
            if (error instanceof AppError) {
                return reply.status(error.statusCode).send({ error: error.message });
            }
            return reply.status(500).send({ error: 'Erro ao processar comando de voz' });
        }
    }
}
export const aiController = new AiController();
