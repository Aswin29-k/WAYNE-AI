import React, { useRef, useEffect, useState } from 'react';
import { useGeminiLive } from './hooks/useGeminiLive';
import { ChatMessage } from './types';
import { MicrophoneIcon, StopIcon, LoadingSpinner, SendIcon, TrashIcon, ImageIcon, CloseIcon, UserIcon, WayneAIIcon, LogoutIcon, ErrorIcon, SparklesIcon } from './components/icons';
import { fileToBase64 } from './utils/imageUtils';
import { useAuth } from './contexts/AuthContext';

const TypingIndicator = () => (
    <div className="flex items-center space-x-1">
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
    </div>
);

const WelcomeScreen = () => (
    <div className="text-center text-slate-400 flex-1 flex flex-col justify-center items-center pb-20">
        <div className="w-24 h-24 bg-gradient-to-br from-violet-600 to-blue-600 rounded-full flex items-center justify-center mb-6 shadow-2xl">
            <WayneAIIcon className="w-12 h-12 text-white" strokeWidth="1.5"/>
        </div>
        <h2 className="text-3xl font-bold text-slate-200 mb-2">Welcome to wayne ai</h2>
        <p className="max-w-md">
            Start a voice conversation, send a message, or upload an image to begin.
        </p>
    </div>
);

const ErrorNotification: React.FC<{ message: string; onDismiss: () => void }> = ({ message, onDismiss }) => (
    <div className="w-full max-w-4xl mx-auto mb-3 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center justify-between animate-fade-in-up">
        <div className="flex items-center gap-3">
            <ErrorIcon className="w-6 h-6 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{message}</p>
        </div>
        <button 
            onClick={onDismiss}
            className="p-1 text-red-300 hover:text-white rounded-full hover:bg-red-500/30 transition-colors"
            aria-label="Dismiss error"
        >
            <CloseIcon className="w-5 h-5" />
        </button>
    </div>
);

const App: React.FC = () => {
  const {
    isConnecting,
    isSessionActive,
    isReplying,
    error: apiError,
    chatHistory,
    currentInput,
    currentOutput,
    startSession,
    stopSession,
    sendTextMessage,
    sendImageEditPrompt,
    generateImageFromText,
    clearChatHistory,
    clearError: clearApiError,
  } = useGeminiLive();

  const { user, logout } = useAuth();
  const [textInput, setTextInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<'text' | 'image-edit' | 'image-gen' | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  
  const error = apiError || uiError;
  const clearError = () => {
    if (apiError) clearApiError();
    if (uiError) setUiError(null);
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, currentInput, currentOutput]);

  // Reset last action when processing is finished
  useEffect(() => {
    if (!isReplying) {
      setLastAction(null);
    }
  }, [isReplying]);
  
  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() && !imageFile) return;

    if (imageFile) {
        setLastAction('image-edit');
        try {
            const imageDetails = await fileToBase64(imageFile);
            sendImageEditPrompt(textInput.trim() || 'Process this image.', imageDetails);
            clearImageSelection();
        } catch (err) {
            console.error("File reading error:", err);
            setUiError("Failed to read the image file. It might be corrupted or in an unsupported format.");
            setLastAction(null);
        }
    } else {
      setLastAction('text');
      sendTextMessage(textInput);
    }
    setTextInput('');
  };

  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || imageFile) return;
    setLastAction('image-gen');
    await generateImageFromText(textInput);
    setTextInput('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  const clearImageSelection = () => {
    setImageFile(null);
    setImagePreviewUrl(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  }

  const handleClearHistory = () => {
    clearChatHistory();
    setIsProfileOpen(false);
  }

  const renderMessage = (msg: ChatMessage) => {
    const isUser = msg.role === 'user';
    const avatar = isUser ? (
      <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
        <img src={user?.picture} alt="User" className="w-8 h-8 rounded-full object-cover" />
      </div>
    ) : (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center flex-shrink-0">
        <WayneAIIcon className="w-5 h-5 text-white" strokeWidth={2} />
      </div>
    );

    return (
        <div key={msg.id} className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            {avatar}
            <div className={`rounded-2xl px-4 py-2.5 max-w-sm md:max-w-md lg:max-w-lg shadow-md ${isUser ? 'bg-violet-600 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}>
            {msg.imageUrl && (
                <img src={msg.imageUrl} alt={isUser ? 'User upload' : 'AI generated image'} className="rounded-lg mb-2 max-w-full h-auto" />
            )}
            {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
            </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen font-sans">
      <header className="sticky top-0 p-4 border-b border-slate-700/50 shadow-md flex justify-between items-center z-10 bg-slate-900/50 backdrop-blur-md">
        <div className="w-10"></div> {/* Spacer to keep title centered */}
        <h1 className="text-xl font-bold text-center text-slate-200 tracking-wider">wayne ai</h1>
        <div className="relative w-10 flex justify-end" ref={profileMenuRef}>
            <button
                onClick={() => setIsProfileOpen(prev => !prev)}
                className="w-8 h-8 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-violet-500"
            >
                <img src={user?.picture} alt="Profile" className="w-full h-full rounded-full object-cover" />
            </button>
            {isProfileOpen && (
                <div className="absolute top-12 right-0 w-64 bg-slate-800/80 backdrop-blur-lg rounded-lg shadow-2xl border border-slate-700/50 z-20 animate-fade-in-up">
                    <div className="p-4 border-b border-slate-700/50">
                        <p className="font-semibold text-slate-200 truncate">{user?.name}</p>
                        <p className="text-sm text-slate-400 truncate">{user?.email}</p>
                    </div>
                    <div className="p-2">
                        <button
                            onClick={handleClearHistory}
                            disabled={isSessionActive || isConnecting || isReplying}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <TrashIcon className="w-5 h-5" />
                            Clear Chat
                        </button>
                        <button
                            onClick={logout}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700/50 rounded-md transition-colors"
                        >
                            <LogoutIcon className="w-5 h-5" />
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
      </header>
      
      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <div className="flex-1 space-y-6">
            {chatHistory.map(renderMessage)}
            {currentInput && (
              <div className="flex items-start gap-3 flex-row-reverse">
                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                    <img src={user?.picture} alt="User" className="w-8 h-8 rounded-full object-cover" />
                </div>
                <div className="rounded-2xl px-4 py-2.5 max-w-sm md:max-w-md lg:max-w-lg bg-violet-600 text-white rounded-br-none opacity-60">
                  <p className="text-sm italic">{currentInput}...</p>
                </div>
              </div>
            )}
            {currentOutput && (
              <div className="flex items-start gap-3 flex-row">
                 <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center flex-shrink-0">
                    <WayneAIIcon className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
                <div className="rounded-2xl px-4 py-2.5 max-w-sm md:max-w-md lg:max-w-lg bg-slate-700 text-slate-200 rounded-bl-none opacity-60">
                   <p className="text-sm italic">{currentOutput}...</p>
                </div>
              </div>
            )}
            {(isReplying && chatHistory.length > 0 && chatHistory[chatHistory.length -1].role === 'user') && (
                 <div className="flex items-start gap-3 flex-row">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center flex-shrink-0">
                        <WayneAIIcon className="w-5 h-5 text-white" strokeWidth={2} />
                    </div>
                    <div className="rounded-2xl px-4 py-3 max-w-sm md:max-w-md lg:max-w-lg bg-slate-700 text-slate-200 rounded-bl-none">
                       <TypingIndicator />
                    </div>
                </div>
            )}
            {!isSessionActive && !isReplying && chatHistory.length === 0 && (
                <WelcomeScreen />
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      </main>

      <footer className="sticky bottom-0 p-4 flex flex-col items-center justify-center border-t border-slate-700/50 z-10 bg-slate-900/50 backdrop-blur-md">
        {error && <ErrorNotification message={error} onDismiss={clearError} />}
         {imagePreviewUrl && (
            <div className="w-full max-w-4xl mx-auto mb-2 p-1.5 bg-slate-800/80 rounded-lg relative self-start animate-fade-in-up">
                <img src={imagePreviewUrl} alt="Image preview" className="max-h-24 rounded-md" />
                <button 
                    onClick={clearImageSelection}
                    className="absolute top-0 right-0 -m-2 bg-slate-600 hover:bg-slate-500 text-white rounded-full p-1 shadow-lg"
                    aria-label="Remove image"
                    >
                    <CloseIcon className="w-4 h-4" />
                </button>
            </div>
         )}
        <div className="w-full max-w-4xl mx-auto flex items-center space-x-3">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
            />
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSessionActive || isReplying || isConnecting}
                className="p-3 rounded-full flex items-center justify-center bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Upload image"
            >
                <ImageIcon className="w-6 h-6 text-slate-300"/>
            </button>
            <form onSubmit={handleSendMessage} className="flex-1 relative flex items-center">
                <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={isSessionActive ? "Voice session active..." : imageFile ? "Describe how to edit the image..." : "Generate an image or type a message..."}
                    disabled={isSessionActive || isReplying || isConnecting}
                    className="w-full bg-slate-800 border border-transparent rounded-full py-3 pl-5 pr-28 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                />
                <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                    <button
                        type="button"
                        onClick={handleGenerateImage}
                        disabled={isSessionActive || isConnecting || isReplying || !!imageFile || !textInput.trim()}
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-violet-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                        aria-label="Generate image"
                    >
                        {isReplying && lastAction === 'image-gen' ? <LoadingSpinner className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5 text-white" />}
                    </button>
                     <button
                        type="submit"
                        disabled={isSessionActive || isConnecting || isReplying || (!textInput.trim() && !imageFile)}
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                        aria-label="Send message"
                    >
                        {isReplying && (lastAction === 'text' || lastAction === 'image-edit') ? <LoadingSpinner className="w-5 h-5" /> : <SendIcon className="w-5 h-5 text-white" />}
                    </button>
                </div>
            </form>
            <div className="relative flex items-center justify-center">
            {isSessionActive && (
                <div className="absolute animate-pulse -inset-2.5 rounded-full bg-blue-500/30"></div>
            )}
            <button
                onClick={isSessionActive ? stopSession : startSession}
                disabled={isConnecting || isReplying || !!imageFile}
                className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-2xl
                ${isConnecting || isReplying || imageFile ? 'bg-slate-600 cursor-not-allowed' : ''}
                ${isSessionActive ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-gradient-to-br from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 focus:ring-violet-500'}
                `}
                aria-label={isSessionActive ? 'Stop conversation' : 'Start conversation'}
            >
                {isConnecting ? (
                <LoadingSpinner className="w-8 h-8" />
                ) : isSessionActive ? (
                <StopIcon className="w-8 h-8 text-white" />
                ) : (
                <MicrophoneIcon className="w-8 h-8 text-white" />
                )}
            </button>
            </div>
        </div>
        <p className="text-xs text-slate-500 mt-3 text-center w-full">Created by aswin kathaperumal</p>
      </footer>
    </div>
  );
};

export default App;