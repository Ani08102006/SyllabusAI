import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs_promises from 'fs/promises';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI, Type, ThinkingLevel, Modality } from '@google/genai';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      throw new Error('GEMINI_API_KEY is not configured or is using the placeholder value.');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

const MODEL_NAME = 'gemini-3.1-flash-lite';
let activeModels = [MODEL_NAME, 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

async function generateWithRetry(params: {
  contents: string | any[];
  config?: any;
}) {
  const ai = getAI();
  let lastError: any = null;
  let isDailyLimitHit = false;
  
  // Make a copy of activeModels to iterate through
  const modelsToTry = [...activeModels];
  
  for (const model of modelsToTry) {
    let retries = 3;
    let delay = 1000;
    
    while (retries > 0) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (error: any) {
        lastError = error;
        const errorMessage = typeof error === 'object' && error !== null ? (error.message || JSON.stringify(error)) : String(error);
        
        const isDailyLimit = 
          errorMessage.includes('GenerateRequestsPerDayPerProjectPerModel') || 
          errorMessage.includes('generate_content_free_tier_requests') ||
          errorMessage.includes('PerDay') ||
          errorMessage.includes('quota') ||
          errorMessage.includes('Quota');

        if (isDailyLimit) {
          isDailyLimitHit = true;
          console.log(`Model ${model} daily quota exceeded. Moving to fallback immediately.`);
          
          // Move this model to the end of the activeModels list
          const index = activeModels.indexOf(model);
          if (index !== -1) {
            activeModels.splice(index, 1);
            activeModels.push(model);
          }
          break; // Exit the retry loop for this model and try the next model
        }

        const isTransient = 
          errorMessage.includes('503') || 
          errorMessage.includes('UNAVAILABLE') || 
          errorMessage.includes('limit') || 
          errorMessage.includes('429') || 
          errorMessage.includes('demand') ||
          errorMessage.includes('temporary');
          
        if (isTransient) {
          retries--;
          if (retries > 0) {
            console.log(`Transient error with model ${model}. Retrying in ${delay}ms... (Error: ${errorMessage})`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
        }
        break;
      }
    }
    console.log(`Model ${model} checked and completed fallback if necessary.`);
  }
  
  if (isDailyLimitHit) {
    throw new Error('Google AI Studio free tier daily quota of 20 requests has been exhausted. Please wait for the daily quota to reset, or configure a paid API key in Google AI Studio to lift limits.');
  }
  
  throw lastError || new Error('Generation failed after retries and fallbacks');
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1); // Trust first proxy
  const PORT = 3000;

  app.use(express.json({ limit: '200mb' }));

  const aiRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: { error: 'Too many requests, please try again in a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
  });
  
  app.use('/api/ai/', aiRateLimiter);
  

  // CORS headers middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // 1. Parse Syllabus
  
  fs_promises.mkdir('/tmp/uploads/', { recursive: true }).catch(()=>{});
const upload = multer({ dest: '/tmp/uploads/', limits: { fileSize: 200 * 1024 * 1024 } });

  app.post('/api/ai/upload-syllabus', upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const ai = getAI();
      const uploadedFile = await ai.files.upload({
        file: file.path,
        config: {
          mimeType: file.mimetype,
          displayName: file.originalname,
        }
      });

      const response = await generateWithRetry({
        contents: [
          { fileData: { fileUri: uploadedFile.uri, mimeType: uploadedFile.mimeType } },
          "Analyze the provided syllabus document and extract the subjects, units, and topics. Also, detect any marks distribution or exam patterns if present."
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subjects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    units: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          topics: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                          }
                        },
                        required: ["name", "topics"]
                      }
                    },
                    marksDistribution: { type: Type.STRING }
                  },
                  required: ["name", "units"]
                }
              }
            },
            required: ["subjects"]
          }
        }
      });

      // Cleanup temp file
      try {
        await fs_promises.unlink(file.path);
      } catch (err) {
        console.error('Error deleting temp file:', err);
      }

      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error('AI API Error (upload):', error);
      res.status(500).json({ 
        error: 'Failed to process syllabus upload', 
        details: error.message || String(error)
      });
    }
  });

  app.post('/api/ai/parse-syllabus', async (req, res) => {
    try {
      const { text } = req.body;
      const response = await generateWithRetry({
        contents: `Analyze the following syllabus text and extract the subjects, units, and topics. Also, detect any marks distribution or exam patterns if present.
        
        Syllabus Text:
        ${text}
        `,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subjects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    units: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          topics: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                          }
                        },
                        required: ['name', 'topics']
                      }
                    },
                    marksDistribution: { type: Type.STRING }
                  },
                  required: ['name', 'units']
                }
              }
            },
            required: ['subjects']
          }
        }
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error('Error parsing syllabus:', error);
      res.status(500).json({ error: error.message || 'Failed to parse syllabus' });
    }
  });

  // 2. Generate Notes
  app.post('/api/ai/generate-notes', async (req, res) => {
    try {
      const { topic, subject, unit } = req.body;
      const response = await generateWithRetry({
        contents: `Generate comprehensive, exam-friendly notes for the topic "${topic}" under the unit "${unit}" for the subject "${subject}".
        Include:
        - Definitions
        - Examples
        - Important formulas (if applicable)
        - Key points for 5-mark and 10-mark answers
        - A brief summary for last-minute revision
        Format the output in Markdown.`,
      });
      res.json({ notes: response.text });
    } catch (error: any) {
      console.error('Error generating notes:', error);
      res.status(500).json({ error: error.message || 'Failed to generate notes' });
    }
  });

  // 3. Generate Question Paper
  app.post('/api/ai/generate-questions', async (req, res) => {
    try {
      const { subject, unit, type, difficulty } = req.body;
      const response = await generateWithRetry({
        contents: `Generate a ${type} question paper for the subject "${subject}", specifically focusing on "${unit}".
        The difficulty level should be ${difficulty}.
        Include a mix of short answer questions (e.g., 2-3 marks) and long answer questions (e.g., 5-10 marks).
        Format the output in Markdown.`,
      });
      res.json({ questions: response.text });
    } catch (error: any) {
      console.error('Error generating questions:', error);
      res.status(500).json({ error: error.message || 'Failed to generate questions' });
    }
  });

  // 4. AI Chat Tutor & Audio Transcriber

app.post('/api/ai/chat', async (req, res) => {
    try {
      const { message, history, model, roleInstruction, useSearch, useThinking } = req.body;
      const ai = getAI();

      let selectedModel = model || activeModels[0];
      if (useThinking) {
        selectedModel = 'gemini-3.1-pro-preview';
      }

      const config: any = {};

      if (roleInstruction) {
        config.systemInstruction = roleInstruction + " If the user asks for a diagram or image, instruct them to switch to the 'Diagrams & Images' tab where they can generate, view, and edit high-quality diagrams.";
      } else {
        config.systemInstruction = "You are StudyForge AI, a brilliant academic tutor. Provide clear explanations, formatting with markdown, and use examples. If the user asks for a diagram or image, instruct them to switch to the 'Diagrams & Images' tab where they can generate, view, and edit high-quality diagrams.";
      }

      if (useSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      if (useThinking && selectedModel === 'gemini-3.1-pro-preview') {
        config.thinkingConfig = {
          thinkingLevel: ThinkingLevel.HIGH,
        };
      }

      let contents: any[] = [];
      if (history && Array.isArray(history)) {
        contents = history.map((h: any) => ({
          role: h.role === 'ai' ? 'model' : 'user',
          parts: [{ text: h.content || '' }]
        }));
      }

      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      console.log(`Calling Chat Gemini: model=${selectedModel}, search=${!!useSearch}, thinking=${!!useThinking}`);

      
      let response;
      if (useThinking) {
        // Simple retry for thinking model
        let retries = 3;
        let delay = 1000;
        let lastError;
        while (retries > 0) {
          try {
            response = await ai.models.generateContent({
              model: selectedModel,
              contents,
              config,
            });
            break;
          } catch (error: any) {
            lastError = error;
            retries--;
            if (retries > 0) {
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
            }
          }
        }
        if (!response) throw lastError;
      } else {
        response = await generateWithRetry({ contents, config });
      }


      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
        title: chunk.web?.title || 'Web Search Result',
        uri: chunk.web?.uri || ''
      })).filter((c: any) => c.uri) || [];

      res.json({
        reply: response.text || '',
        sources
      });
    } catch (error: any) {
      console.error('Error in chat:', error);
      res.status(500).json({ error: error.message || 'Failed to get chat response' });
    }
  });

  // Audio Transcription Endpoint
  app.post('/api/ai/transcribe', async (req, res) => {
    try {
      const { audio, mimeType } = req.body;
      if (!audio) {
        return res.status(400).json({ error: 'Audio data is required' });
      }

      const audioPart = {
        inlineData: {
          mimeType: mimeType || 'audio/webm',
          data: audio
        }
      };
      
      const response = await generateWithRetry({
        contents: [
          audioPart,
          "Transcribe this audio precisely. Return only the transcription text, no other comments."
        ]
      });

      res.json({ text: response.text || '' });
    } catch (error: any) {
      console.error('Error transcribing audio:', error);
      res.status(500).json({ error: error.message || 'Failed to transcribe audio' });
    }
  });

  // 5. Generate Assignment Content
  app.post('/api/ai/generate-assignment', async (req, res) => {
    try {
      const { topic, subject, pages } = req.body;
      const response = await generateWithRetry({
        contents: `Write an academic assignment on the topic "${topic}" for the subject "${subject}".
        The length should be appropriate for approximately ${pages} handwritten pages.
        Write it in a natural student style, not overly robotic.
        Do not use markdown formatting like bold or headers, just plain text with paragraphs.`,
      });
      res.json({ content: response.text });
    } catch (error: any) {
      console.error('Error generating assignment:', error);
      res.status(500).json({ error: error.message || 'Failed to generate assignment' });
    }
  });

  // 6. Generate Study Schedule
  app.post('/api/ai/generate-schedule', async (req, res) => {
    try {
      const { subjects } = req.body;
      if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
        return res.status(400).json({ error: 'No subjects provided to generate schedule.' });
      }

      const response = await generateWithRetry({
        contents: `You are an expert academic mentor. Create a structured, highly realistic 7-day study plan based on the student's subjects and units/topics.
        Provide 1 to 2 highly actionable study tasks per day.
        Spread the tasks across 7 days (represented by dayOffset: 0 for today, 1 for tomorrow, ..., up to 6 for 6 days from today).
        Make the tasks specific and goal-oriented based on the units or topics, e.g., "Revise Unit 1: Introduction to Mechanics and practice 3 problems", "Summarize key terms in Chapter 2".

        Subjects and their units/topics list:
        ${JSON.stringify(subjects, null, 2)}
        `,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    subjectName: { type: Type.STRING },
                    title: { type: Type.STRING },
                    dayOffset: { type: Type.INTEGER }
                  },
                  required: ['subjectName', 'title', 'dayOffset']
                }
              }
            },
            required: ['tasks']
          }
        }
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error('Error generating schedule:', error);
      res.status(500).json({ error: error.message || 'Failed to generate study schedule' });
    }
  });

  // 7. Generate Flashcards
  app.post("/api/ai/image", async (req, res) => {
    try {
      const { prompt, model, size, mode, referenceImage } = req.body;
      const ai = getAI();
      
      const diagramInstructions = "\n\nCreate a clear, high-quality diagram representing this request. If it's a flowchart, mind map, UML diagram, ER diagram, process diagram, network diagram, study diagram, architecture diagram, or scientific diagram, ensure the layout is clean, legible, and professional. Optimize for maximum accuracy and visual hierarchy. Make text easy to read.";
      
      let optionsTemplate: any = {};
      
      if (mode === "edit" && referenceImage) {
        const base64Data = referenceImage.split(",")[1];
        const mimeMatch = referenceImage.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        
        optionsTemplate.input = [
          {
            type: "image",
            data: base64Data,
            mime_type: mimeType,
          },
          {
            type: "text",
            text: prompt + diagramInstructions,
          }
        ];
      } else {
        optionsTemplate.input = prompt + diagramInstructions;
        optionsTemplate.generation_config = {
          image_config: {
            aspect_ratio: "1:1",
            image_size: size || "1K",
          }
        };
      }
      
      let activeImageModels = ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'];
      let preferredModel = model || "gemini-3-pro-image-preview";
      let modelsToTry = [preferredModel, ...activeImageModels.filter(m => m !== preferredModel)];
      let lastError = null;
      let imageUrl = null;

      for (const currentModel of modelsToTry) {
        let retries = 2;
        let delay = 1500;

        while (retries > 0) {
          try {
            const options = { ...optionsTemplate, model: currentModel };
            const interaction = await ai.interactions.create(options);
            
            for (const step of interaction.steps) {
              if (step.type === "model_output") {
                const imageContent: any = step.content?.find((c: any) => c.type === "image");
                if (imageContent && imageContent.data) {
                  const mimeType = imageContent.mime_type || "image/png";
                  imageUrl = `data:${mimeType};base64,${imageContent.data}`;
                }
              }
            }
            if (imageUrl) break;
            throw new Error("No image generated by the model");
          } catch (error: any) {
            lastError = error;
            const errorMessage = typeof error === 'object' && error !== null ? (error.message || JSON.stringify(error)) : String(error);
            
            const isQuota = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('limit') || errorMessage.includes('Quota');
            const isTransient = errorMessage.includes('503') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('temporary');

            if (isQuota) {
                console.log(`Model ${currentModel} quota exceeded. Moving to fallback.`);
                break; // Exit retry loop, try next model
            }

            if (isTransient) {
              retries--;
              if (retries > 0) {
                console.log(`Transient error with ${currentModel}, retrying in ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                delay *= 2;
                continue;
              }
            }
            
            // Other error, exit retry loop
            break;
          }
        }
        
        if (imageUrl) {
            break; // Stop trying models if we got an image
        }
      }
      
      if (!imageUrl) {
          const errorStr = lastError ? (lastError.message || String(lastError)) : '';
          
          if (errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('limit') || errorStr.includes('Quota')) {
             console.log("Quota exceeded, falling back to Pollinations API");
             const safePrompt = encodeURIComponent(prompt);
             let pxSize = 1024;
             if (size === '2K') pxSize = 2048;
             if (size === '4K') pxSize = 4096;
             imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?nologo=1&width=${pxSize}&height=${pxSize}`;
          } else {
             throw lastError || new Error("Failed to generate image after trying available models.");
          }
      }
      
      res.json({ imageUrl });
    } catch (error: any) {
      console.error("Error generating image:", error);
      res.status(500).json({ error: error.message || "Failed to generate image" });
    }
  });

  
  app.post('/api/sync-sheets', async (req, res) => {
    try {
      const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
      if (!webhookUrl) {
        return res.status(200).json({ message: 'Webhook URL not configured, skipping sync.' });
      }
      
      try {
        new URL(webhookUrl);
      } catch (e) {
        console.error("Invalid webhook URL configured, skipping sync.");
        return res.status(200).json({ message: 'Invalid Webhook URL configured, skipping sync.' });
      }
      
      const result = await fetch(webhookUrl, {
        method: 'POST',
        body: JSON.stringify(req.body)
      });
      
      const data = await result.text();
      res.status(200).json({ status: 'success', data });
    } catch (e) {
      console.error("Sheets sync failed:", e);
      res.status(500).json({ error: 'Failed to sync to sheets' });
    }
  });

  app.post('/api/ai/generate-flashcards', async (req, res) => {
    try {
      const { subject, unit } = req.body;
      if (!subject || !unit) {
        return res.status(400).json({ error: 'Subject and Unit are required to generate flashcards.' });
      }

      const response = await generateWithRetry({
        contents: `You are an expert educator. Create 8 to 12 comprehensive study flashcards for the subject "${subject}", specifically focusing on the unit/chapter "${unit}".
        Each card must have:
        1. "front": A concise question, term, or prompt (e.g., "What is Newton's Second Law?", "Define Mitochondria", "Explain the purpose of standard deviation").
        2. "back": A clear, educational, and complete answer, formula, definition, or key points (keep it readable and digestible but informative).

        Ensure high relevance to the specified subject and unit. Avoid overly generic questions.
        `,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              flashcards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    front: { type: Type.STRING },
                    back: { type: Type.STRING }
                  },
                  required: ['front', 'back']
                }
              }
            },
            required: ['flashcards']
          }
        }
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      console.error('Error generating flashcards:', error);
      res.status(500).json({ error: error.message || 'Failed to generate flashcards' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Create unified HTTP + WebSocket Server
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on('connection', async (clientWs, req) => {
    console.log(`Received WebSocket connection on ${req.url}`);
    if (!req.url || !req.url.startsWith('/api/live')) {
      clientWs.close();
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY is not configured or is a placeholder.' }));
      clientWs.close();
      return;
    }

    const liveAi = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    try {
      const session = await liveAi.live.connect({
        model: 'gemini-2.0-flash',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are StudyForge Voice, an academic tutor. Give concise, conversational, and helpful study assistance.',
        },
        callbacks: {
          onmessage: (message: any) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ audio }));
            }
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
        },
      });

      clientWs.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
            });
          }
        } catch (err) {
          console.error('Error handling live audio client message:', err);
        }
      });

      clientWs.on('close', () => {
        try {
          session.close();
        } catch (err) {}
      });
    } catch (err: any) {
      console.error('Gemini Live API error:', err);
      clientWs.send(JSON.stringify({ error: err.message || 'Live connection failed' }));
      clientWs.close();
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
