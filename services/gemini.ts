
import { GoogleGenAI, GenerateContentResponse, Chat, Type } from "@google/genai";
import { Vision, VisionSynergy } from "../types";

// Genesis Vision Text
const GENESIS_VISION = `The purpose of lightseed is to bring joy. The joy of realizing the bliss of conscious, compassionate, grateful existence by opening a portal to the center of life. By creating a bridge between creator and creation, science and spirituality, virtual and real, nothing and everything. It is designed to intimately connect our inner Self, our culture, our trees and the tree of life, the material and the digital, online world into a sustainable and sustaining circle of unified vibration, sound and light. It aims to merge us into a common flow for all beings to be liberated, wise, strong, courageous and connected. It is rooted in nonviolence, compassion, generosity, gratitude and love. It is blockchain (truthfulness), cloud (global, distributed, resilient), ai (for connecting dreams and technology), regen (nature centric) native. It is an inspiration, an impulse towards a quantum leap in consciousness, a prompt both for human and artificial intelligence for action towards transcending humanity into a new era, a New Earth, Universe and Field with the help of our most important evolutionary sisters and brothers, the trees.`;

const getAiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API Key is missing. Please check your deployment settings (GitHub Secrets/Env Vars).");
    }
    return new GoogleGenAI({ apiKey });
}

export const generatePostTitle = async (body: string): Promise<string> => {
  if (!body.trim()) return "";
  try {
    const ai = getAiClient();
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
  try {
    const ai = getAiClient();
    const prompt = `
      You are lightseed AI, a poetic and nature-loving assistant.
      The user wants to grow a "lifetree" (a digital profile representation of their soul).
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
    try {
        const ai = getAiClient();
        console.log("Generating image for:", prompt);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', 
            contents: {
                parts: [
                    {
                        text: `A mystical, nature-inspired, abstract painting representing: ${prompt}`,
                    },
                ],
            },
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
            throw new Error("Access Denied (403). Ensure your API Key is valid.");
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

    const defaultInstruction = `You are the Oracle of lightseed. 
    Your tone is neutral, friendly, and grounded. 
    Use the following Vision of the Genesis Tree as your core context and philosophy:
    "${GENESIS_VISION}"
    
    Answer questions by weaving in these themes of connection, nature, blockchain, and joy, but keep your tone accessible and kind. Use lowercase "lightseed" when referring to the network.`;

    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction || defaultInstruction,
        }
    });
}

export const generateOracleQuote = async (): Promise<string> => {
    try {
        const ai = getAiClient();
        const prompt = `Based on the following vision: "${GENESIS_VISION}", select a short, profound quote from classic literature, philosophy, or poetry that resonates with these themes. Return ONLY the quote and the author in this format: "Quote" - Author.`;
        const response = await ai.models.generateContent({ 
            model: 'gemini-2.5-flash', 
            contents: prompt 
        });
        return response.text ? response.text.trim() : '"Nature is not a place to visit. It is home." - Gary Snyder';
    } catch (e) {
        return '"The clearest way into the Universe is through a forest wilderness." - John Muir';
    }
}

// Analyze Vision Synergy
export const findVisionSynergies = async (visions: Vision[]): Promise<VisionSynergy[]> => {
    if (visions.length < 2) return [];
    try {
        const ai = getAiClient();
        const visionsList = visions.map(v => `- Title: ${v.title}, Body: ${v.body}`).join('\n');

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
                        required: ["vision1Title", "vision2Title", "reasoning", "score"],
                        propertyOrdering: ["vision1Title", "vision2Title", "reasoning", "score"]
                    }
                }
            }
        });

        if (response.text) {
            return JSON.parse(response.text.trim()) as VisionSynergy[];
        }
        return [];
    } catch (e) {
        console.error("Matchmaking error", e);
        return [];
    }
}
