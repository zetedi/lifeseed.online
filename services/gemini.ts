
import { GoogleGenAI } from "@google/genai";
import { type GenerateContentResponse } from "@google/genai";

// Read API Key from Vite Environment Variables
const API_KEY = (import.meta as any).env.VITE_API_KEY;

// Lazy initialization to prevent top-level crash
let aiClient: GoogleGenAI | null = null;

const getAiClient = () => {
    if (!aiClient) {
        if (!API_KEY) {
            console.warn("LifeSeed: VITE_API_KEY is missing in .env");
            return null;
        }
        aiClient = new GoogleGenAI({ apiKey: API_KEY });
    }
    return aiClient;
}

export const generatePostTitle = async (body: string): Promise<string> => {
  if (!body.trim()) {
    return "";
  }
  
  const ai = getAiClient();
  if (!ai) return "";

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
  
  const ai = getAiClient();
  if (!ai) {
      console.warn("Gemini API Key missing");
      return "Roots run deep... (AI key missing)";
  }

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

// Generate Image for Visions (Nano Banana)
export const generateVisionImage = async (prompt: string): Promise<string | null> => {
    if (!prompt.trim()) return null;
    const ai = getAiClient();
    if (!ai) {
        throw new Error("API Key Missing");
    }

    try {
        console.log("Generating vision image with Nano Banana...");
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Nano Banana
            contents: {
                parts: [{ text: `A mystical, nature-inspired, abstract painting representing: ${prompt}` }]
            },
            config: {
                imageConfig: {
                    aspectRatio: "1:1",
                    // imageSize is NOT supported by gemini-2.5-flash-image, only pro models
                }
            }
        });

        // The response will contain base64 image data
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        console.warn("Nano Banana: No image data returned in response.");
        return null;
    } catch (e: any) {
        console.error("Error generating image:", e);
        
        // Handle Rate Limiting / Quota issues specifically
        const errorMsg = e.toString().toLowerCase();
        if (errorMsg.includes("429") || errorMsg.includes("quota") || errorMsg.includes("resource_exhausted")) {
             throw new Error("Daily quota or rate limit exceeded. Please wait 30 seconds and try again.");
        }

        // Throw specific error message to be caught by UI
        throw new Error(e.message || "Unknown GenAI Error");
    }
}
