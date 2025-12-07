import { GoogleGenAI } from "@google/genai";
import { type GenerateContentResponse } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

export const generatePostTitle = async (body: string): Promise<string> => {
  if (!body.trim()) {
    return "";
  }
  
  try {
    const prompt = `Generate a short, engaging title (maximum 10 words) for the following post body. Do not use quotation marks in the title:\n\n---\n${body}\n---`;
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const title = response.text ? response.text.trim().replace(/["']/g, '') : ""; // Remove quotes
    return title;

  } catch (error) {
    console.error("Error generating title with Gemini:", error);
    return "";
  }
};

export const generateLifetreeBio = async (seed: string): Promise<string> => {
  if (!seed.trim()) return "";

  try {
    const prompt = `
      You are LifeSeed AI, a poetic and nature-loving assistant.
      The user wants to grow a "Lifetree" (a digital profile representation of their soul).
      They provided this seed thought: "${seed}".
      
      Write a short (max 40 words), mystical, and nature-inspired bio/description for their Lifetree.
      It should sound organic, peaceful, and connected to the earth.
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    
    return response.text ? response.text.trim() : "";
  } catch (error) {
    console.error("Error generating bio:", error);
    return "";
  }
}