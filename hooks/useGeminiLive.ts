import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Chat } from '@google/genai';
import { ChatMessage } from '../types';
import { decode, decodeAudioData, createBlob } from '../utils/audioUtils';

type LiveSession = Awaited<
  ReturnType<InstanceType<typeof GoogleGenAI>['live']['connect']>
>;

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const SCRIPT_PROCESSOR_BUFFER_SIZE = 4096;
const SYSTEM_INSTRUCTION =
  'You are a helpful and friendly AI assistant. Be concise and clear in your responses.';

export const useGeminiLive = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('chatHistory');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');

  const sessionPromise = useRef<Promise<LiveSession> | null>(null);
  const chatSession = useRef<Chat | null>(null);

  const getApiKey = () => {
    const key = import.meta.env.VITE_GEMINI_API_KEY as string;
    if (!key) {
      throw new Error('VITE_GEMINI_API_KEY not found in .env file');
    }
    return key;
  };

  /* ================= START SESSION ================= */

  const startSession = useCallback(async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const ai = new GoogleGenAI({
        apiKey: getApiKey(),
      });

      sessionPromise.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
        },
      });

      setIsSessionActive(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  /* ================= TEXT MESSAGE ================= */

  const sendTextMessage = useCallback(
    async (message: string) => {
      try {
        setIsReplying(true);

        const ai = new GoogleGenAI({
          apiKey: getApiKey(),
        });

        if (!chatSession.current) {
          chatSession.current = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: chatHistory.map(msg => ({
              role: msg.role,
              parts: [{ text: msg.text }],
            })),
            config: { systemInstruction: SYSTEM_INSTRUCTION },
          });
        }

        const result = await chatSession.current.sendMessage({ message });

        setChatHistory(prev => [
          ...prev,
          { id: `user-${Date.now()}`, role: 'user', text: message },
          { id: `model-${Date.now()}`, role: 'model', text: result.text },
        ]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsReplying(false);
      }
    },
    [chatHistory]
  );

  /* ================= IMAGE GENERATION ================= */

  const generateImageFromText = useCallback(async (prompt: string) => {
    try {
      setIsReplying(true);

      const ai = new GoogleGenAI({
        apiKey: getApiKey(),
      });

      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: { numberOfImages: 1 },
      });

      const img = response.generatedImages[0]?.image.imageBytes;
      if (!img) throw new Error('No image generated');

      setChatHistory(prev => [
        ...prev,
        {
          id: `model-${Date.now()}`,
          role: 'model',
          text: 'Here is the image',
          imageUrl: `data:image/png;base64,${img}`,
        },
      ]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsReplying(false);
    }
  }, []);

  return {
    isConnecting,
    isSessionActive,
    isReplying,
    error,
    chatHistory,
    currentInput,
    currentOutput,
    startSession,
    sendTextMessage,
    generateImageFromText,
  };
};
