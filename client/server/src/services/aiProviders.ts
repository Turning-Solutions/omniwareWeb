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
        // Free model lists change weekly — the picker loads the live list instead of hard-coding names.
        defaultModel: '',
        models: [],
        minGapSeconds: 4,
        chunkSize: 10,
        note: 'Many models behind one key. Free models cost nothing (roughly 20 requests/minute, ~50/day without credits) but come and go — pick one from the live list below.',
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
    /** The provider's API key (or base URL for custom) is set, regardless of model. */
    keySet: boolean;
}

/** The provider + model currently selected (DB setting, else environment, else Gemini default). */
export async function getActiveAi(): Promise<ActiveAi> {
    const saved = await AiSetting.findOne({ key: 'default' }).lean();
    const provider = providerById(saved?.provider) ?? providerById(process.env.AI_PROVIDER) ?? PROVIDERS[0];
    const envModel = provider.id === 'gemini' ? process.env.GEMINI_MODEL : process.env.AI_MODEL;
    const model = (saved?.provider === provider.id && saved.modelName) || envModel?.trim() || provider.defaultModel;
    const keySet = isProviderConfigured(provider);
    return { provider, model, configured: keySet && Boolean(model), keySet };
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
    keySet: active.keySet,
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

export interface ModelOption {
    id: string;
    label?: string;
    note?: string;
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim());
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

const NON_CHAT_MODEL = /embed|whisper|tts|speech|transcri|moderation|guard|rerank|image|vision-preview|dall-?e/i;

/**
 * Models the provider offers right now. For OpenRouter only FREE models are listed (public endpoint,
 * no key needed); other providers are asked with the server-side key.
 */
export async function listProviderModels(p: ProviderDef): Promise<ModelOption[]> {
    if (p.kind === 'gemini') {
        const key = process.env[p.keyEnv]?.trim();
        if (!key) throw new Error(`${p.keyEnv} is not set`);
        const data = (await getJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { 'x-goog-api-key': key })) as {
            models?: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[];
        };
        return (data.models ?? [])
            .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && /gemini/i.test(m.name))
            .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName }))
            .sort((a, b) => b.id.localeCompare(a.id));
    }

    if (p.id === 'openrouter') {
        const data = (await getJson('https://openrouter.ai/api/v1/models')) as {
            data?: {
                id: string;
                name?: string;
                context_length?: number;
                pricing?: { prompt?: string; completion?: string };
                supported_parameters?: string[];
                architecture?: { output_modalities?: string[] };
            }[];
        };
        return (data.data ?? [])
            .filter((m) => {
                const free = m.id.endsWith(':free') || (Number(m.pricing?.prompt) === 0 && Number(m.pricing?.completion) === 0);
                const textOut = !m.architecture?.output_modalities || m.architecture.output_modalities.every((x) => x === 'text');
                return free && textOut && !NON_CHAT_MODEL.test(m.id) && !m.id.startsWith('openrouter/');
            })
            .sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0))
            .map((m) => {
                const json = m.supported_parameters?.some((x) => x === 'response_format' || x === 'structured_outputs');
                const ctx = m.context_length ? `${Math.round(m.context_length / 1000)}k context` : '';
                return { id: m.id, label: m.name, note: [ctx, json ? 'JSON mode' : ''].filter(Boolean).join(' · ') };
            });
    }

    const baseUrl = baseUrlOf(p);
    if (!baseUrl) throw new Error(`${p.baseUrlEnv ?? 'Base URL'} is not set`);
    const key = process.env[p.keyEnv]?.trim();
    if (!key && !p.keyOptional) throw new Error(`${p.keyEnv} is not set`);
    const data = (await getJson(`${baseUrl.replace(/\/+$/, '')}/models`, key ? { Authorization: `Bearer ${key}` } : {})) as {
        data?: { id: string }[];
    };
    return (data.data ?? [])
        .filter((m) => !NON_CHAT_MODEL.test(m.id))
        .map((m) => ({ id: m.id }))
        .sort((a, b) => a.id.localeCompare(b.id));
}
