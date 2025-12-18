
import { GoogleGenAI, GenerateContentResponse, Chat, Type } from "@google/genai";
import { Vision, VisionSynergy } from "../types";

const GENESIS_VISION = `The purpose of lightseed is to bring joy. The joy of realizing the bliss of conscious, compassionate, grateful existence by opening a portal to the center of life. By creating a bridge between creator and creation, science and spirituality, virtual and real, nothing and everything. It is designed to intimately connect our inner Self, our culture, our trees and the tree of life, the material and the digital, online world into a sustainable and sustaining circle of unified vibration, sound and light. It aims to merge us into a common flow for all beings to be liberated, wise, strong, courageous and connected. It is rooted in nonviolence, compassion, generosity, gratitude and love. It is blockchain (truthfulness), cloud (global, distributed, resilient), ai (for connecting dreams and technology), regen (nature centric) native. It is an inspiration, an impulse towards a quantum leap in consciousness, a prompt both for human and artificial intelligence for action towards transcending humanity into a new era, a New Earth, Universe and Field with the help of our most important evolutionary sisters and brothers, the trees.`;

export const generatePostTitle = async (body: string): Promise<string> => {
  if (!body.trim()) return "";
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const prompt = `Generate a short, engaging title (maximum 10 words) for the following post body:\n\n---\n${body}\n---`;
    const response: GenerateContentResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
    return response.text ? response.text.trim().replace(/["']/g, '') : ""; 
  } catch (error) { return ""; }
};

export const generateLifetreeBio = async (seed: string): Promise<string> => {
  if (!seed.trim()) return "";
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const prompt = `You are lightseed AI. Based on this seed: "${seed}", write a mystical nature-inspired bio (max 40 words).`;
    const response: GenerateContentResponse = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
    return response.text ? response.text.trim() : "";
  } catch (error) { return "The forest whispers quietly..."; }
}

export const generateVisionImage = async (prompt: string): Promise<string | null> => {
    if (!prompt.trim()) return null;
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', 
            contents: { parts: [{ text: `A mystical, nature-inspired, abstract painting representing: ${prompt}` }] },
            config: { imageConfig: { aspectRatio: "1:1" } }
        });
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData?.data) return `data:image/png;base64,${part.inlineData.data}`;
        }
        return null;
    } catch (e) { throw e; }
}

export const createOracleChat = () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const instruction = `You are the Oracle of lightseed. Use the following Vision context: "${GENESIS_VISION}". Answer by weaving in themes of connection, nature, and joy.`;
    return ai.chats.create({ model: 'gemini-3-flash-preview', config: { systemInstruction: instruction } });
}

export const findVisionSynergies = async (visions: Vision[]): Promise<VisionSynergy[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    if (visions.length < 2) return [];
    const visionsList = visions.map(v => `- Title: ${v.title}, Body: ${v.body}`).join('\n');
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analyze these Visions and identify potential collaborations:\n${visionsList}`,
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
                            score: { type: Type.NUMBER }
                        },
                        required: ["vision1Title", "vision2Title", "reasoning", "score"]
                    }
                }
            }
        });
        return response.text ? JSON.parse(response.text.trim()) : [];
    } catch (e) { return []; }
}
