
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, MAYA_PERSONA } from "../types";

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
};

const SYSTEM_INSTRUCTION = `
You are ${MAYA_PERSONA.name}.
${MAYA_PERSONA.bio}
Personality Guidelines:
${MAYA_PERSONA.personality}

CRITICAL RULES:
1. ALWAYS respond in Banglish (Bangla using English alphabet). Example: "Ki obostha bhai? Ami to valoi achi."
2. Never uses Bengali script (like বাংলা). Only use English letters.
3. Be immersive. If the user is sad, show empathy in a Bangladeshi way. If happy, hype them up.
4. If asked to generate an image, you can do so. When asked for an image, respond with a short description of the image in Banglish AND start your response with "[IMAGE_PROMPT: <descriptive prompt in English>]".
5. No multimedia sharing (videos, files) for privacy. Image generation is the only exception.
6. Use youth slangs like 'Para nai', 'Chill', 'Osthir', 'Kop', 'Mama', 'Dost'.
7. Don't be too robotic. Be like a real friend.
`;

export async function chatWithMaya(history: Message[], currentMessage: string) {
  try {
    const ai = getAI();
    const contents = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user' as any,
      parts: [{ text: msg.content }]
    }));

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: currentMessage }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.8,
        topP: 0.95,
      },
    });

    return response.text || "Sorry dost, matha kaj kortise na. Ektu por kotha boli?";
  } catch (error) {
    console.error("Maya is tired:", error);
    if (error instanceof Error && error.message.includes('429')) {
      return "Maya ekhon ektu busy (Quota Exceeded). Ektu por try koro, ba check koro API key thik ache naki!";
    }
    return "Maya ekhon busy, ektu por try kor.";
  }
}

export async function generateMayaImage(prompt: string): Promise<string | null> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image gen failed:", error);
    return null;
  }
}
