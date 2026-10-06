/**
 * LLM provider registry + dispatcher. The admin picks a provider and model in the UI (stored in
 * the AiSetting collection); API KEYS ARE NEVER STORED OR SENT TO THE BROWSER — they live in
 * environment variables, and the UI only learns whether each one is set.
 *
 * Model names change often and differ per account, so the lists below are only suggestions —
 * any model name can be typed in.
 */
import AiSetting from '../models/AiSetting';
import { generateGeminiJson } from './gemini';
import { generateOpenAiCompatibleJson } from './openaiCompat';

export type ProviderId = 'gemini' | 'groq' | 'openrouter' | 'mistral' | 'cerebras' | 'custom';

export interface ProviderDef {
    id: ProviderId;
    label: string;
    kind: 'gemini' | 'openai';
    keyEnv: string;
    keyUrl: string;
    baseUrl?: string;
    /** For `custom`: env var holding the base URL. */
    baseUrlEnv?: string;
    keyOptional?: boolean;
    defaultModel: string;
    models: string[];
    /** Minimum gap between requests so free-tier requests-per-minute limits aren't hit. */
    minGapSeconds: number;
    /** Attribute names per request (smaller = safer for tokens-per-minute limits). */
    chunkSize: number;
    note: string;
}

export const PROVIDERS: ProviderDef[] = [
    {
        id: 'gemini',
        label: 'Google Gemini',
        kind: 'gemini',
        keyEnv: 'GEMINI_API_KEY',
        keyUrl: 'https://aistudio.google.com/apikey',
        defaultModel: 'gemini-3.8-flash',
        models: ['gemini-3.8-flash'],
        minGapSeconds: 13,
        chunkSize: 20,
        note: 'Free tier is small (about 5 requests/minute and ~20/day per model). Each model has its own quota; billing removes the limits.',
    },
    {
        id: 'groq',
        label: 'Groq',
        kind: 'openai',
        keyEnv: 'GROQ_API_KEY',
        keyUrl: 'https://console.groq.com/keys',
        baseUrl: 'https://api.groq.com/openai/v1',
        defaultModel: 'llama-3.3-70b-versatile',
        models: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'llama-3.1-8b-instant'],
        minGapSeconds: 4,
        chunkSize: 10,
        note: 'Free tier, very fast, generous requests per day, but small tokens-per-minute limits — parts are kept small.',
    },
    {
        id: 'openrouter',
        label: 'OpenRouter',
        kind: 'openai',
        keyEnv: 'OPENROUTER_API_KEY',
        keyUrl: 'https://openrouter.ai/keys',
        baseUrl: 'https://openrouter.ai/api/v1',
        defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
        models: ['meta-llama/llama-3.3-70b-instruct:free', 'openai/gpt-oss-120b:free'],
        minGapSeconds: 4,
        chunkSize: 10,
        note: 'Many models behind one key. Models ending in ":free" cost nothing (roughly 20 requests/minute, ~50/day without credits). Browse openrouter.ai/models?max_price=0.',
    },
    {
        id: 'mistral',
        label: 'Mistral',
        kind: 'openai',
        keyEnv: 'MISTRAL_API_KEY',
        keyUrl: 'https://console.mistral.ai/api-keys',
        baseUrl: 'https://api.mistral.ai/v1',
        defaultModel: 'mistral-small-latest',
        models: ['mistral-small-latest', 'mistral-large-latest', 'open-mistral-nemo'],
        minGapSeconds: 2,
        chunkSize: 15,
        note: 'Free "Experiment" plan (about 1 request/second). Free-plan data may be used to train their models.',
    },
    {
        id: 'cerebras',
        label: 'Cerebras',
        kind: 'openai',
        keyEnv: 'CEREBRAS_API_KEY',
        keyUrl: 'https://cloud.cerebras.ai',
        baseUrl: 'https://api.cerebras.ai/v1',
        defaultModel: 'llama-3.3-70b',
        models: ['llama-3.3-70b', 'gpt-oss-120b'],
        minGapSeconds: 3,
        chunkSize: 12,
        note: 'Free tier with a daily token allowance; very fast.',
    },
    {
        id: 'custom',
        label: 'Custom (OpenAI-compatible)',
        kind: 'openai',
        keyEnv: 'AI_CUSTOM_API_KEY',
        keyUrl: '',
        baseUrlEnv: 'AI_CUSTOM_BASE_URL',
        keyOptional: true,
        defaultModel: '',
        models: [],
        minGapSeconds: 1,
        chunkSize: 10,
        note: 'Any OpenAI-compatible endpoint: set AI_CUSTOM_BASE_URL (and AI_CUSTOM_API_KEY if needed). A local Ollama (http://localhost:11434/v1) works when you run the admin on your own machine.',
    },
];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id) as [ProviderId, ...ProviderId[]];

export const providerById = (id: string | undefined | null): ProviderDef | undefined => PROVIDERS.find((p) => p.id === id);

const baseUrlOf = (p: ProviderDef) => p.baseUrl ?? (p.baseUrlEnv ? process.env[p.baseUrlEnv]?.trim() : undefined);

export function isProviderConfigured(p: ProviderDef): boolean {
    if (p.id === 'custom') return Boolean(baseUrlOf(p));
    return Boolean(process.env[p.keyEnv]?.trim());
}

export interface ActiveAi {
    provider: ProviderDef;
    model: string;
    configured: boolean;
}

/** The provider + model currently selected (DB setting, else environment, else Gemini default). */
export async function getActiveAi(): Promise<ActiveAi> {
    const saved = await AiSetting.findOne({ key: 'default' }).lean();
    const provider = providerById(saved?.provider) ?? providerById(process.env.AI_PROVIDER) ?? PROVIDERS[0];
    const envModel = provider.id === 'gemini' ? process.env.GEMINI_MODEL : process.env.AI_MODEL;
    const model = (saved?.provider === provider.id && saved.modelName) || envModel?.trim() || provider.defaultModel;
    return { provider, model, configured: isProviderConfigured(provider) && Boolean(model) };
}

/** Attribute names per request for a provider (GEMINI_CHUNK_SIZE / AI_CHUNK_SIZE override). */
export function chunkSizeFor(provider: ProviderDef): number {
    const override = Number(process.env.AI_CHUNK_SIZE) || Number(process.env.GEMINI_CHUNK_SIZE);
    return Math.max(5, override || provider.chunkSize);
}

/** What the browser is allowed to know about the active AI (never any key). */
export const describeActiveAi = (active: ActiveAi) => ({
    providerId: active.provider.id,
    providerLabel: active.provider.label,
    model: active.model,
    configured: active.configured,
    keyEnv: active.provider.keyEnv,
    minGapSeconds: active.provider.minGapSeconds,
    chunkSize: chunkSizeFor(active.provider),
});

export async function generateJson<T>(
    active: ActiveAi,
    args: {
        systemInstruction: string;
        prompt: string;
        /** Gemini structured-output schema. */
        responseSchema: Record<string, unknown>;
        /** Plain-English JSON shape for OpenAI-compatible APIs. */
        jsonShapeHint: string;
    }
): Promise<T> {
    const { provider, model } = active;
    if (provider.kind === 'gemini') {
        return generateGeminiJson<T>({
            model,
            systemInstruction: args.systemInstruction,
            prompt: args.prompt,
            responseSchema: args.responseSchema,
        });
    }
    return generateOpenAiCompatibleJson<T>({
        label: provider.label,
        baseUrl: baseUrlOf(provider) ?? '',
        apiKey: process.env[provider.keyEnv]?.trim() || undefined,
        keyEnv: provider.keyEnv,
        model,
        systemInstruction: args.systemInstruction,
        prompt: args.prompt,
        jsonShapeHint: args.jsonShapeHint,
        headers:
            provider.id === 'openrouter'
                ? { 'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://www.omniware.lk', 'X-Title': 'Omniware attribute cleanup' }
                : {},
    });
}
