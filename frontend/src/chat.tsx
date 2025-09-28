import React, { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    if (!inputValue.trim() || isLoading) return;

    const messageContent = inputValue;
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      content: messageContent,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // TODO: Add actual API integration
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

      const assistantMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        content: 'This is a placeholder response. Backend integration coming soon.',
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <div className="w-5 h-5 text-white font-bold text-center">AI</div>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">AI Assistant</h1>
            <p className="text-xs text-slate-500">Powered by LangGraph</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="p-4 bg-blue-50 rounded-full w-16 h-16 mx-auto mb-4">
              <div className="w-full h-full text-blue-600 font-bold text-center text-2xl">AI</div>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Welcome to AI Assistant</h3>
            <p className="text-slate-500 max-w-sm mx-auto">
              Ask me anything about the current webpage, fill forms, or get help with research tasks.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex w-full items-end justify-end gap-2 py-4 ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}>
            <div className={`flex flex-col gap-2 overflow-hidden rounded-lg px-4 py-3 text-foreground text-sm max-w-[80%] ${
              message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
            }`}>
              <div>{message.content}</div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex w-full items-end justify-start gap-2 py-4">
            <div className="flex flex-col gap-2 overflow-hidden rounded-lg px-4 py-3 text-foreground text-sm max-w-[80%] bg-gray-100">
              <div className="flex items-center gap-2 text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
                <span>AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="w-full divide-y overflow-hidden rounded-xl border bg-background shadow-sm m-4">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.currentTarget.value)}
          onKeyDown={handleKeyPress}
          placeholder="Ask me anything about this page, fill forms, or research topics..."
          className="w-full resize-none border-none p-3 shadow-none outline-none ring-0 focus-visible:ring-0 bg-transparent"
          disabled={isLoading}
        />
        <div className="flex items-center justify-between p-1">
          <div></div>
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="shrink-0 gap-1.5 rounded-lg h-8 w-8 bg-blue-600 text-white flex items-center justify-center disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
