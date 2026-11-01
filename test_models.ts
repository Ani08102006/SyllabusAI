import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const res = await (ai.models as any).generateImage({
      model: 'imagen-3.0-generate-001',
      prompt: 'A red apple',
    });
    console.log("Success with imagen-3.0-generate-001");
  } catch (e) {
    console.log("Failed:", e.message);
  }
}

test();
