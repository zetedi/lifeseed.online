
import { GoogleGenAI, GenerateContentResponse, Chat, Type } from "@google/genai";
import { Vision, VisionSynergy } from "../types";

// Helper to get a fresh client instance every time.
const getAiClient = (): GoogleGenAI | null => {
    // We explicitly check window.process.env to get the dynamic key injected by the UI
    // falling back to the standard process.env (handled by polyfill)
    const win = window as any;
    const apiKey = (win.process?.env?.API_KEY || process.env.API_KEY || "").trim();
    
    if (!apiKey) {
        console.warn("LifeSeed: API Key is missing.");
        return null;
    }
    
    return new GoogleGenAI({ apiKey });
}

export const generatePostTitle = async (body: string): Promise<string> => {
  if (!body.trim()) return "";
  const ai = getAiClient();
  if (!ai) return "";

  try {
    const prompt = `Generate a short, engaging title (maximum 10 words) for the following post body. Do not use quotation marks in the title:\n\n---\n${body}\n---`;
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text ? response.text.trim().replace(/["']/g, '') : ""; 
  } catch (error) {
    console.error("Gemini Title Error:", error);
    return "";
  }
};

export const generateLifetreeBio = async (seed: string): Promise<string> => {
  if (!seed.trim()) return "";
  const ai = getAiClient();
  if (!ai) return "Roots run deep... (Please connect AI Key)";

  try {
    const prompt = `
      You are LifeSeed AI, a poetic and nature-loving assistant.
      The user wants to grow a "Lifetree" (a digital profile representation of their soul).
      They provided this seed thought: "${seed}".
      Write a short (max 40 words), mystical, and nature-inspired bio/description.
    `;
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    return response.text ? response.text.trim() : "";
  } catch (error) {
    console.error("Gemini Bio Error:", error);
    return "The forest whispers quietly... (AI Error)";
  }
}

// Generate Image for Visions (Nano Banana)
export const generateVisionImage = async (prompt: string): Promise<string | null> => {
    if (!prompt.trim()) return null;
    const ai = getAiClient();
    if (!ai) throw new Error("API Key Missing. Please select your key using the Key icon.");

    try {
        console.log("Generating image for:", prompt);
        
        // Use simplified string content to minimize 403 errors from complex object parsing
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', 
            contents: `A mystical, nature-inspired, abstract painting representing: ${prompt}`,
            config: {
                imageConfig: {
                    aspectRatio: "1:1"
                }
            }
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                const mimeType = part.inlineData.mimeType || 'image/png';
                return `data:${mimeType};base64,${part.inlineData.data}`;
            }
        }
        return null;

    } catch (e: any) {
        console.error("Gemini Image Error:", e);
        const errorMsg = e.toString().toLowerCase();
        
        if (errorMsg.includes("403")) {
            throw new Error("Access Denied (403). Ensure your API Key is valid and has permission for Generative AI.");
        }
        if (errorMsg.includes("429") || errorMsg.includes("quota")) {
             throw new Error("Quota exceeded. Please wait a moment.");
        }
        throw new Error("AI Generation Failed. Please try again.");
    }
}

// New Chat Interface
export const createOracleChat = (systemInstruction?: string) => {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key Missing");

    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction || "You are the LifeSeed Oracle, an ancient digital spirit of the forest. You speak in metaphors, trees, and roots. You are wise, calm, and helpful, but always maintain your mystical forest persona. Keep answers relatively short and poetic.",
        }
    });
}

// Analyze Vision Synergy
export const findVisionSynergies = async (visions: Vision[]): Promise<VisionSynergy[]> => {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key Missing");
    
    if (visions.length < 2) return [];
    const visionsList = visions.map(v => `- Title: ${v.title}, Body: ${v.body}`).join('\n');

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze the following list of Visions and identify potential collaborations or thematic synergies between them. 
            Return a JSON array of pairs that match well.
            
            Visions:
            ${visionsList}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            vision1Title: { type: Type.STRING },
                            vision2Title: { type: Type.STRING },
                            reasoning: { type: Type.STRING },
                            score: { type: Type.NUMBER, description: "Match score from 0 to 100" }
                        },
                        required: ["vision1Title", "vision2Title", "reasoning", "score"]
                    }
                }
            }
        });

        if (response.text) {
            return JSON.parse(response.text) as VisionSynergy[];
        }
        return [];
    } catch (e) {
        console.error("Matchmaking error", e);
        return [];
    }
}
