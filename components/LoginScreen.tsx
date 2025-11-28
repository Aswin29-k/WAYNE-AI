import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GoogleIcon, WayneAIIcon } from './icons';

const LoginScreen: React.FC = () => {
  const { login, loginAsGuest } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center h-screen font-sans text-center p-4">
      <div className="w-28 h-28 bg-gradient-to-br from-violet-600 to-blue-600 rounded-full flex items-center justify-center mb-6 shadow-2xl">
        <WayneAIIcon className="w-14 h-14 text-white" strokeWidth="1.5" />
      </div>
      <h1 className="text-4xl font-bold text-slate-100 mb-2">Welcome to wayne ai</h1>
      <p className="text-slate-400 mb-8 max-w-md">
        Your multi-modal AI assistant. Sign in to start a conversation, edit images, and more.
      </p>
      <div className="flex flex-col items-center gap-4">
        <button
          onClick={login}
          className="flex items-center justify-center gap-3 bg-white text-slate-700 font-semibold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-blue-500/50"
        >
          <GoogleIcon className="w-6 h-6" />
          Sign in with Google
        </button>
        <button
          onClick={loginAsGuest}
          className="text-sm text-slate-400 hover:text-slate-200 transition-colors duration-300"
        >
          Continue as Guest
        </button>
      </div>
       <p className="text-xs text-slate-500 mt-20 text-center w-full">Created by aswin kathaperumal</p>
    </div>
  );
};

export default LoginScreen;