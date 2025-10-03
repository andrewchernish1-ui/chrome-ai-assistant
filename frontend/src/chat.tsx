import React, { useState, useEffect, useRef } from 'react';
import { ElevenLabsClient, play } from '@elevenlabs/elevenlabs-js';

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
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioController, setAudioController] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <span
            key={index}
            className="text-blue-300 underline hover:text-blue-200 cursor-pointer"
            onClick={() => {
              if (chrome && chrome.tabs) {
                chrome.tabs.create({ url: part });
              } else {
                window.open(part, '_blank');
              }
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

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

      // Автоматическое озвучивание ответа ассистента
      synthesizeSpeech(assistantMessage.content);
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

  // Получение контента текущей страницы
  const getPageContent = async () => {
    if (!chrome || !chrome.runtime) {
      console.error('Chrome runtime not available');
      return null;
    }

    try {
      const response = await chrome.runtime.sendMessage({ action: 'getPageContent' });
      return response;
    } catch (error) {
      console.error('Error getting page content:', error);
      return null;
    }
  };

  // Создание краткого изложения страницы
  const createPageSummary = (pageData: any) => {
    if (!pageData || !pageData.text) {
      return 'Не удалось получить контент страницы.';
    }

    const { title, text, url } = pageData;

    // Создаем краткое изложение из первых предложений текста
    const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
    const summary = sentences.slice(0, 3).join('. ').trim();

    if (summary.length === 0) {
      return `Страница "${title}" не содержит достаточно текста для создания изложения.`;
    }

    return `Краткое изложение страницы "${title}": ${summary}.`;
  };

  // Синтез речи с помощью ElevenLabs
  const synthesizeSpeech = async (text: string) => {
    if (isPlayingAudio) {
      // Если уже играет, остановить текущий
      if (audioController) {
        audioController.stop();
        setAudioController(null);
      }
      setIsPlayingAudio(false);
      return;
    }

    try {
      setIsPlayingAudio(true);

      const elevenlabs = new ElevenLabsClient({
        apiKey: '8913dc0722ac37c97af76e28c762d9585236aeef52e4a1bfce1981c75085e615',
      });

      const audio = await elevenlabs.textToSpeech.convert(
        'pNInz6obpgDQGcFmaJgB', // Adam - мужской голос
        {
          text: text,
          modelId: 'eleven_turbo_v2', // Более естественная модель
          outputFormat: 'mp3_44100_128',
        }
      );

      const controller = await play(audio);
      setAudioController(controller);

      // Обработка окончания воспроизведения
      controller.onEnded = () => {
        setIsPlayingAudio(false);
        setAudioController(null);
      };

    } catch (error) {
      console.error('Error synthesizing speech:', error);
      alert('Ошибка при合成езе речи. Проверьте консоль для деталей.');
      setIsPlayingAudio(false);
      setAudioController(null);
    }
  };

  // Обработчик нажатия кнопки синтеза речи
  const handleSpeechSynthesis = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const pageData = await getPageContent();
      if (!pageData) {
        alert('Не удалось получить контент страницы');
        return;
      }

      const summary = createPageSummary(pageData);
      await synthesizeSpeech(summary);
    } catch (error) {
      console.error('Error in speech synthesis process:', error);
      alert('Произошла ошибка при обработке страницы');
    } finally {
      setIsLoading(false);
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
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {renderTextWithLinks(message.content)}
              </div>
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
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSpeechSynthesis}
              disabled={isLoading}
              className={`shrink-0 gap-1.5 rounded-lg h-8 w-8 ${isPlayingAudio ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white flex items-center justify-center disabled:opacity-50 transition-colors`}
              title={isPlayingAudio ? "Остановить озвучивание" : "Озвучить содержание страницы"}
            >
              {isPlayingAudio ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                </svg>
              )}
            </button>
            {isPlayingAudio && (
              <div className="text-xs text-gray-400">Озвучивание...</div>
            )}
          </div>
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
