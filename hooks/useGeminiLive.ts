

import { useState, useRef, useCallback, useEffect } from 'react';
// FIX: `LiveSession` is not an exported member of `@google/genai`.
// It has been removed from the import statement.
import { GoogleGenAI, LiveServerMessage, Modality, Chat } from '@google/genai';
import { ChatMessage } from '../types';
import { decode, decodeAudioData, createBlob } from '../utils/audioUtils';

// FIX: The `LiveSession` type is not exported from the library.
// We can define it using the return type of the `ai.live.connect` method for type safety.
type LiveSession = Awaited<ReturnType<InstanceType<typeof GoogleGenAI>['live']['connect']>>;

// Constants
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const SCRIPT_PROCESSOR_BUFFER_SIZE = 4096;
const SYSTEM_INSTRUCTION = 'You are a helpful and friendly AI assistant. Be concise and clear in your responses.';


export const useGeminiLive = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load chat history from localStorage on initial load.
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('chatHistory');
      return saved ? JSON.parse(saved) : [];
    } catch (err) {
      console.error("Failed to load chat history from localStorage", err);
      return [];
    }
  });

  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');

  const sessionPromise = useRef<Promise<LiveSession> | null>(null);
  const chatSession = useRef<Chat | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const inputAudioContext = useRef<AudioContext | null>(null);
  const outputAudioContext = useRef<AudioContext | null>(null);
  const scriptProcessor = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSource = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTime = useRef(0);
  const audioSources = useRef(new Set<AudioBufferSourceNode>());
  const currentInputRef = useRef('');
  const currentOutputRef = useRef('');

  // Save chat history to localStorage whenever it changes.
  useEffect(() => {
    try {
      // Create a version of the history without large image data for storage.
      const storableHistory = chatHistory.map(({ imageUrl, ...rest }) => rest);
      localStorage.setItem('chatHistory', JSON.stringify(storableHistory));
    } catch (err) {
      console.error("Failed to save chat history to localStorage", err);
    }
  }, [chatHistory]);

  const getOutputAudioContext = useCallback(() => {
    if (!outputAudioContext.current) {
      // FIX: Cast window to any to access webkitAudioContext for broader browser compatibility.
      outputAudioContext.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
    }
    return outputAudioContext.current;
  }, []);

  const cleanup = useCallback(() => {
    scriptProcessor.current?.disconnect();
    scriptProcessor.current = null;
    mediaStreamSource.current?.disconnect();
    mediaStreamSource.current = null;
    
    inputAudioContext.current?.close().catch(console.error);
    inputAudioContext.current = null;
    // Don't close output context as it can be reused by text chat
    
    mediaStream.current?.getTracks().forEach(track => track.stop());
    mediaStream.current = null;

    audioSources.current.forEach(source => source.stop());
    audioSources.current.clear();

    sessionPromise.current?.then(session => session.close()).catch(console.error);
    sessionPromise.current = null;

    setIsSessionActive(false);
    setIsConnecting(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const startSession = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    setCurrentInput('');
    setCurrentOutput('');
    currentInputRef.current = '';
    currentOutputRef.current = '';
    chatSession.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStream.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      // FIX: Cast window to any to access webkitAudioContext for broader browser compatibility.
      inputAudioContext.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
      getOutputAudioContext();

      sessionPromise.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onopen: () => {
            if (!inputAudioContext.current || !mediaStream.current) return;
            setIsConnecting(false);
            setIsSessionActive(true);

            mediaStreamSource.current = inputAudioContext.current.createMediaStreamSource(mediaStream.current);
            scriptProcessor.current = inputAudioContext.current.createScriptProcessor(SCRIPT_PROCESSOR_BUFFER_SIZE, 1, 1);
            
            scriptProcessor.current.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              if (sessionPromise.current) {
                 sessionPromise.current.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };

            mediaStreamSource.current.connect(scriptProcessor.current);
            scriptProcessor.current.connect(inputAudioContext.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              currentInputRef.current += text;
              setCurrentInput(currentInputRef.current);
            }
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              currentOutputRef.current += text;
              setCurrentOutput(currentOutputRef.current);
            }
            if (message.serverContent?.turnComplete) {
                const finalInput = currentInputRef.current.trim();
                const finalOutput = currentOutputRef.current.trim();
                if (finalInput || finalOutput) {
                    setChatHistory(prev => [
                        ...prev,
                        ...(finalInput ? [{ id: `user-${Date.now()}`, role: 'user' as const, text: finalInput }] : []),
                        ...(finalOutput ? [{ id: `model-${Date.now()}`, role: 'model' as const, text: finalOutput }] : []),
                    ]);
                }
              currentInputRef.current = '';
              currentOutputRef.current = '';
              setCurrentInput('');
              setCurrentOutput('');
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContext.current) {
                const oac = outputAudioContext.current;
                nextStartTime.current = Math.max(nextStartTime.current, oac.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64Audio), oac, OUTPUT_SAMPLE_RATE, 1);
                const source = oac.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(oac.destination);
                source.addEventListener('ended', () => audioSources.current.delete(source));
                source.start(nextStartTime.current);
                nextStartTime.current += audioBuffer.duration;
                audioSources.current.add(source);
            }

            if (message.serverContent?.interrupted) {
                audioSources.current.forEach(source => source.stop());
                audioSources.current.clear();
                nextStartTime.current = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            setError(`Session error: ${e.message}`);
            cleanup();
          },
          onclose: () => {
            cleanup();
          },
        },
      });
    } catch (err) {
        if (err instanceof DOMException) {
            if (err.name === 'NotAllowedError') {
              setError('Microphone access was denied. Please allow microphone access in your browser settings to use voice chat.');
            } else if (err.name === 'NotFoundError') {
              setError('No microphone was found. Please connect a microphone and try again.');
            } else {
              setError(`Could not access microphone: ${err.message}`);
            }
        } else if (err instanceof Error) {
            setError(`Failed to start session: ${err.message}`);
        } else {
            setError('An unknown error occurred while starting the session.');
        }
        cleanup();
    }
  }, [cleanup, getOutputAudioContext]);

  const stopSession = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const sendTextMessage = useCallback(async (message: string) => {
    setIsReplying(true);
    setError(null);

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text: message };
    setChatHistory(prev => [...prev, userMessage]);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

        if (!chatSession.current) {
            chatSession.current = ai.chats.create({
                model: 'gemini-2.5-flash',
                history: chatHistory.filter(msg => !msg.imageUrl).map(msg => ({ // Filter out image messages from history for text model
                    role: msg.role,
                    parts: [{ text: msg.text }]
                })),
                config: {
                    systemInstruction: SYSTEM_INSTRUCTION
                }
            });
        }
        
        const result = await chatSession.current.sendMessage({ message });
        const modelResponseText = result.text;
        
        const modelMessage: ChatMessage = { id: `model-${Date.now()}`, role: 'model', text: modelResponseText };
        setChatHistory(prev => [...prev, modelMessage]);

        // Graceful TTS generation
        try {
            const ttsResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: modelResponseText }] }],
                config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: {
                      voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                  },
                },
            });
          
            const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            const oac = getOutputAudioContext();
    
            if (base64Audio && oac) {
                nextStartTime.current = Math.max(nextStartTime.current, oac.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64Audio), oac, OUTPUT_SAMPLE_RATE, 1);
                const source = oac.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(oac.destination);
                source.addEventListener('ended', () => audioSources.current.delete(source));
                source.start(nextStartTime.current);
                nextStartTime.current += audioBuffer.duration;
                audioSources.current.add(source);
            }
        } catch (ttsError) {
            console.error("Text-to-speech generation failed:", ttsError);
            // Non-critical error, do not show to user as the text response was successful.
        }

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to send message: ${errorMessage}. Please check your connection and try again.`);
        setChatHistory(prev => prev.slice(0, -1)); // Remove optimistic user message
    } finally {
        setIsReplying(false);
    }

  }, [chatHistory, getOutputAudioContext]);

  const sendImageEditPrompt = useCallback(async (
    prompt: string,
    image: { base64: string; mimeType: string; dataUrl: string }
  ) => {
    setIsReplying(true);
    setError(null);
    chatSession.current = null; // Reset text chat session

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: prompt,
      imageUrl: image.dataUrl,
    };
    setChatHistory(prev => [...prev, userMessage]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
      const imagePart = {
        inlineData: { data: image.base64, mimeType: image.mimeType },
      };
      const textPart = { text: prompt };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, textPart] },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      const firstPart = response.candidates?.[0]?.content?.parts?.[0];
      if (firstPart && 'inlineData' in firstPart && firstPart.inlineData) {
        const { data, mimeType } = firstPart.inlineData;
        const editedImageUrl = `data:${mimeType};base64,${data}`;
        const modelMessage: ChatMessage = {
          id: `model-${Date.now()}`,
          role: 'model',
          text: 'Here is the edited image.',
          imageUrl: editedImageUrl,
        };
        setChatHistory(prev => [...prev, modelMessage]);
      } else {
        throw new Error('No image was generated. The model may not have understood the prompt.');
      }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Image editing failed: ${errorMessage}. The model may not support this request.`);
        setChatHistory(prev => prev.slice(0, -1)); // Remove optimistic user message
    } finally {
      setIsReplying(false);
    }
  }, []);

  const generateImageFromText = useCallback(async (prompt: string) => {
    setIsReplying(true);
    setError(null);
    chatSession.current = null; // Reset text chat session

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: `Generate an image of: ${prompt}`,
    };
    setChatHistory(prev => [...prev, userMessage]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/png',
          aspectRatio: '1:1',
        },
      });

      const base64ImageBytes = response.generatedImages[0]?.image.imageBytes;

      if (base64ImageBytes) {
        const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
        const modelMessage: ChatMessage = {
          id: `model-${Date.now()}`,
          role: 'model',
          text: 'Here is the image you requested.',
          imageUrl: imageUrl,
        };
        setChatHistory(prev => [...prev, modelMessage]);
      } else {
        throw new Error('The model did not return an image. Please try a different prompt.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Image generation failed: ${errorMessage}`);
      setChatHistory(prev => prev.slice(0, -1)); // Remove optimistic user message
    } finally {
      setIsReplying(false);
    }
  }, []);

  const clearChatHistory = useCallback(() => {
    setChatHistory([]);
    setCurrentInput('');
    setCurrentOutput('');
    currentInputRef.current = '';
    currentOutputRef.current = '';
    chatSession.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
      outputAudioContext.current?.close().catch(console.error);
    };
  }, [cleanup]);

  return {
    isConnecting,
    isSessionActive,
    isReplying,
    error,
    chatHistory,
    currentInput,
    currentOutput,
    startSession,
    stopSession,
    sendTextMessage,
    sendImageEditPrompt,
    generateImageFromText,
    clearChatHistory,
    clearError,
  };
};