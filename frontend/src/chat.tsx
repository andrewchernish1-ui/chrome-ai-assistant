import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
        content: `В этой школе вы сможете овладеть навыками в следующих областях:

**Графика:**
Photoshop, Illustrator, InDesign, ретушь.

**Фотография:**
различные жанры фотографии, обработка в Lightroom и Capture One.

**Нейросети:**
использование нейросетей для работы, творчества и жизни.`,
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
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-800/80 backdrop-blur-sm border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <div className="w-5 h-5 text-white font-bold text-center">AI</div>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-100">ИИ-Ассистент</h1>
            <p className="text-xs text-gray-400">Powered by LangGraph</p>
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
            <h3 className="text-lg font-medium text-gray-100 mb-2">Добро пожаловать в ИИ-Ассистент</h3>
            <p className="text-gray-400 max-w-sm mx-auto">
              Здесь вы можете спрашивать всё о текущей странице, получать помощь с заполнением форм и исследованиями.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex w-full items-end justify-end gap-2 py-4 ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}>
            <div className={`flex flex-col gap-2 overflow-hidden rounded-lg px-4 py-3 text-foreground text-sm max-w-[80%] ${
              message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'
            }`}>
              {message.role === 'assistant' ? (
                <ReactMarkdown remarkPlugins={[[remarkGfm, {}]]}>{message.content}</ReactMarkdown>
              ) : (
                <div>{message.content}</div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex w-full items-end justify-start gap-2 py-4">
            <div className="flex flex-col gap-2 overflow-hidden rounded-lg px-4 py-3 text-foreground text-sm max-w-[80%] bg-gray-600">
              <div className="flex items-center gap-2 text-white">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>ИИ думает...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="w-full divide-y overflow-hidden rounded-xl border bg-gray-900 shadow-sm m-4">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.currentTarget.value)}
          onKeyDown={handleKeyPress}
          placeholder="Задайте вопрос о странице, заполните формы или исследуйте темы..."
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
