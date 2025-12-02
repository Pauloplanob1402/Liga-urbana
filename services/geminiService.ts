import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AIEnhancementResult } from "../types";

// Inicialização Segura: Só cria o cliente se a chave existir
let ai: GoogleGenAI | null = null;
const apiKey = process.env.API_KEY;

if (apiKey && apiKey.startsWith("AIza")) {
    try {
        ai = new GoogleGenAI({ apiKey: apiKey });
    } catch (e) {
        console.warn("Erro ao iniciar IA, usando modo offline.");
    }
}

// Schema for structured JSON output
const enhancementSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    improvedText: {
      type: Type.STRING,
      description: "A more polite, clear, and community-focused version of the user's request.",
    },
    safetyTip: {
      type: Type.STRING,
      description: "A short, practical safety tip related to meeting strangers for this specific type of task.",
    },
    encouragement: {
      type: Type.STRING,
      description: "A short, emotional phrase encouraging community connection.",
    },
  },
  required: ["improvedText", "safetyTip", "encouragement"],
};

export const enhanceRequestContent = async (
  originalText: string,
  category: string
): Promise<AIEnhancementResult> => {
  // Fallback imediato se não tiver IA configurada
  const fallbackResult = {
      improvedText: originalText,
      safetyTip: "Encontre-se sempre em locais públicos e avise alguém de confiança.",
      encouragement: "Sua comunidade está aqui para ajudar!",
  };

  if (!ai) return fallbackResult;

  try {
    const prompt = `
      O usuário está criando um pedido de ajuda no app "Liga Urbana", focado em comunidade e gentileza.
      Categoria: ${category}.
      Texto original: "${originalText}".
      
      Tarefa:
      1. Reescreva o texto para ser mais amigável, claro e engajador, mantendo o sentido original.
      2. Forneça uma dica de segurança curta e específica para este tipo de interação presencial.
      3. Crie uma frase curta de encorajamento.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: enhancementSchema,
        systemInstruction: "You are a helpful community manager AI that promotes kindness, clarity, and safety.",
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as AIEnhancementResult;
    }
    
    throw new Error("No response text");
  } catch (error) {
    console.error("Gemini enhancement failed:", error);
    return fallbackResult;
  }
};

export const generateCommunityTip = async (): Promise<string> => {
    if (!ai) return "Pequenos gestos transformam o dia.";

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Gere uma dica muito curta (máx 15 palavras) inspiradora sobre viver em comunidade na cidade grande.",
        });
        return response.text || "Pequenos gestos transformam o dia.";
    } catch (e) {
        return "Conecte-se com quem está ao seu lado.";
    }
}