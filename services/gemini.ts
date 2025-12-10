
import { GoogleGenAI, GenerateContentResponse, Chat } from "@google/genai";

// Helper to get a fresh client instance every time.
// This ensures we capture the API Key if it is injected dynamically by the UI (window.aistudio).
const getAiClient = (): GoogleGenAI | null => {
    // process.env.API_KEY is the strict requirement.
    // We access it dynamically to support runtime injection.
    const apiKey = process.env.API_KEY ? process.env.API_KEY.trim() : "";
    
    if (!apiKey) {
        console.warn("LifeSeed: process.env.API_KEY is missing. Please select an API key via the UI or check your .env file.");
        return null;
    }
    
    return new GoogleGenAI({ apiKey });
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

    return response.text ? response.text.trim().replace(/["']/g, '') : ""; // Remove quotes

  } catch (error) {
    console.error("Error generating title with Gemini:", error);
    return "";
  }
};

export const generateLifetreeBio = async (seed: string): Promise<string> => {
  if (!seed.trim()) return "";
  
  const ai = getAiClient();
  if (!ai) {
      // Return a fallback so the UI doesn't crash, but warn user
      console.warn("Gemini API Key missing");
      return "Roots run deep... (Please connect AI Key via the Key icon)";
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
    return "The forest whispers quietly... (AI Error)";
  }
}

// Generate Image for Visions (Nano Banana)
export const generateVisionImage = async (prompt: string): Promise<string | null> => {
    if (!prompt.trim()) return null;
    const ai = getAiClient();
    if (!ai) {
        throw new Error("API Key Missing. Please ensure API_KEY is set in your .env file or connected via the UI.");
    }

    try {
        console.log("Generating vision image with Nano Banana...");
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Nano Banana
            contents: [
                { 
                    parts: [{ text: `A mystical, nature-inspired, abstract painting representing: ${prompt}` }] 
                }
            ],
            config: {
                imageConfig: {
                    aspectRatio: "1:1",
                    // imageSize is NOT supported by gemini-2.5-flash-image
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
        if (errorMsg.includes("key not valid") || errorMsg.includes("api_key_invalid") || errorMsg.includes("403")) {
            throw new Error("Invalid API Key. Please check your .env file or re-select your key using the Key icon.");
        }

        // Throw specific error message to be caught by UI
        throw new Error(e.message || "Unknown GenAI Error");
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
