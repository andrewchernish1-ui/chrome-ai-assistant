const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const speechButton = document.getElementById('speechButton');

// Generate session ID if not exists
let sessionId = localStorage.getItem('aiAssistantSessionId');
if (!sessionId) {
  sessionId = crypto.randomUUID();
  localStorage.setItem('aiAssistantSessionId', sessionId);
}

// Состояние для контроля аудио
let isPlayingAudio = false;
let audioController = null;

function addMessage(content, isUser = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isUser ? 'user' : 'assistant'}`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = content;

  messageDiv.appendChild(contentDiv);
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function getPageContent() {
  try {
    console.log('🔄 Getting page content...');

    // Проверяем, доступен ли chrome API
    if (!chrome || !chrome.runtime) {
      console.error('❌ Chrome runtime not available');
      return {
        summarized: '',
        details: { title: 'Chrome API недоступен', text: '', url: '', forms: [] }
      };
    }

    const response = await chrome.runtime.sendMessage({ action: 'getPageContent' });
    console.log('📨 Received response from background script:', response);

    // Проверяем ответ
    if (!response) {
      console.error('❌ No response from background script');
      return {
        summarized: '',
        details: { title: 'Нет ответа от background script', text: '', url: '', forms: [] }
      };
    }

    // Проверяем, есть ли контент
    if (!response.text || response.text.trim().length === 0) {
      console.warn('⚠️ No text content found, trying fallback method');
      // Попробуем получить контент напрямую
      const fallbackContent = await getPageContentFallback();
      if (fallbackContent) {
        response.text = fallbackContent;
        console.log('✅ Fallback content extracted:', response.text.substring(0, 100));
      }
    }

    // Create compressed human-readable summary
    const pageContent = `Page Title: ${response.title || 'Без названия'}
URL: ${response.url || window.location.href}
Content: ${(response.text || '').replace(/\s+/g, ' ').slice(0, 3000)}
Forms: ${response.forms ? response.forms.map(form => `${form.id}: ${form.fields.map(f => `${f.label || f.name}`).join(', ')}`).join('; ') : 'Нет форм'}`;

    console.log('✅ Page content extracted successfully');
    console.log('📄 Title:', response.title);
    console.log('🔗 URL:', response.url);
    console.log('📝 Text length:', response.text ? response.text.length : 0);

    return {
      summarized: pageContent,
      details: response
    };
  } catch (error) {
    console.error('❌ Failed to get page content:', error);
    console.error('❌ Error details:', error.message);

    return {
      summarized: '',
      details: {
        title: 'Ошибка извлечения контента',
        text: `Произошла ошибка при извлечении контента страницы: ${error.message}`,
        url: window.location?.href || '',
        forms: []
      }
    };
  }
}

// Fallback метод для извлечения контента страницы
async function getPageContentFallback() {
  try {
    console.log('🔄 Trying fallback content extraction...');

    // Простой метод извлечения текста
    const text = document.body ? document.body.innerText || document.body.textContent || '' : '';
    const title = document.title || 'Без названия';
    const url = window.location.href || '';

    if (text.trim().length > 0) {
      console.log('✅ Fallback content extracted successfully');
      return text.trim().slice(0, 5000);
    } else {
      console.warn('⚠️ Fallback method also returned empty content');
      return '';
    }
  } catch (error) {
    console.error('❌ Fallback method also failed:', error);
    return '';
  }
}

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message || sendButton.disabled) return;

  addMessage(message, true);
  messageInput.value = '';
  sendButton.disabled = true;

  try {
    const pageContext = await getPageContent();

    const response = await fetch(`http://localhost:8000/chat/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        page_content: pageContext.summarized,
        page_details: pageContext.details
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const assistantResponse = data.response;
    addMessage(assistantResponse, false);

    // Автоматическое озвучивание ответа ассистента
    setTimeout(() => {
      if (!isPlayingAudio) {
        synthesizeSpeech(assistantResponse);
      }
    }, 500); // Небольшая задержка перед озвучиванием
  } catch (error) {
    console.error('Error:', error);
    addMessage('Ошибка подключения к ИИ-ассистенту. Пожалуйста, попробуйте снова.', false);
  } finally {
    sendButton.disabled = false;
  }
}

// Создание краткого изложения страницы
function createPageSummary(pageData) {
  if (!pageData || !pageData.details || !pageData.details.text) {
    return 'Не удалось получить контент страницы.';
  }

  const { title, text, url } = pageData.details;

  // Создаем краткое изложение из первых предложений текста
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const summary = sentences.slice(0, 3).join('. ').trim();

  if (summary.length === 0) {
    return `Страница "${title}" не содержит достаточно текста для создания изложения.`;
  }

  return `Краткое изложение страницы "${title}": ${summary}.`;
}

// Синтез речи с помощью ElevenLabs (основной метод) или Web Speech API
function updateSpeechButton() {
  if (isPlayingAudio) {
    speechButton.innerHTML = `
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
        <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        <path d="M9 10h6"></path>
      </svg>
    `;
    speechButton.style.backgroundColor = '#dc2626'; // Красный для стоп
    speechButton.title = 'Остановить озвучивание';
  } else {
    speechButton.innerHTML = `
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
      </svg>
    `;
    speechButton.style.backgroundColor = '#10b981'; // Зеленый для старт
    speechButton.title = 'Озвучить содержание страницы';
  }
}

async function synthesizeSpeech(text) {
  if (isPlayingAudio) {
    // Останавливаем текущее воспроизведение
    if (audioController) {
      audioController.stop();
      audioController = null;
    }
    // Останавливаем Web Speech API если используется
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isPlayingAudio = false;
    updateSpeechButton();
    return;
  }

  try {
    isPlayingAudio = true;
    updateSpeechButton();

    // Сначала пробуем ElevenLabs - лучшее качество голоса
    console.log('🔊 Starting speech synthesis with ElevenLabs for text:', text.substring(0, 50) + '...');
    const elevenLabsResult = await synthesizeSpeechElevenLabs(text);

    if (elevenLabsResult) {
      console.log('✅ ElevenLabs synthesis completed successfully');
      // Устанавливаем глобальную переменную для отслеживания метода
      window.lastSpeechMethod = 'ElevenLabs';
      return true;
    } else {
      console.log('🔄 ElevenLabs failed, trying Web Speech API...');
      // Fallback на Web Speech API если ElevenLabs не работает
      const webSpeechResult = await synthesizeSpeechWebAPI(text);
      if (webSpeechResult) {
        window.lastSpeechMethod = 'Web Speech API';
      }
      return webSpeechResult;
    }
  } catch (error) {
    console.error('❌ Error in speech synthesis:', error);
    // Последний fallback на Web Speech API
    const webSpeechResult = await synthesizeSpeechWebAPI(text);
    if (webSpeechResult) {
      window.lastSpeechMethod = 'Web Speech API';
    }
    return webSpeechResult;
  } finally {
    if (!isPlayingAudio) {
      updateSpeechButton();
    }
  }
}

// Синтез речи через ElevenLabs (если пользователь предоставит правильный API ключ)
async function synthesizeSpeechElevenLabs(text) {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        const response = chrome.runtime.sendMessage({
          action: 'synthesizeSpeech',
          text: text,
          model_id: 'eleven_turbo_v2', // Более естественная модель
          voice_id: 'pNInz6obpgDQGcFmaJgB', // Adam - мужской голос
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        }, (response) => {
          if (response && response.success) {
            console.log('✅ ElevenLabs synthesis completed successfully');

            const audioBlob = new Blob([Uint8Array.from(atob(response.audioData), c => c.charCodeAt(0))], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            audio.addEventListener('ended', () => {
              URL.revokeObjectURL(audioUrl);
              isPlayingAudio = false;
              updateSpeechButton();
            });

            audio.addEventListener('error', () => {
              URL.revokeObjectURL(audioUrl);
              isPlayingAudio = false;
              updateSpeechButton();
            });

            audio.play().catch(() => {
              // Обработка ошибки воспроизведения
              URL.revokeObjectURL(audioUrl);
              isPlayingAudio = false;
              updateSpeechButton();
            });
            resolve(true);
          } else {
            console.warn('⚠️ ElevenLabs synthesis failed - invalid API key');
            isPlayingAudio = false;
            updateSpeechButton();
            resolve(false);
          }
        });
      } else {
        console.warn('⚠️ Chrome runtime not available for ElevenLabs');
        isPlayingAudio = false;
        updateSpeechButton();
        resolve(false);
      }
    } catch (error) {
      console.error('❌ Error in ElevenLabs synthesis:', error);
      isPlayingAudio = false;
      updateSpeechButton();
      resolve(false);
    }
  });
}

// Fallback на Web Speech API
async function synthesizeSpeechWebAPI(text) {
  return new Promise((resolve) => {
    try {
      if ('speechSynthesis' in window) {
        console.log('🔊 Using Web Speech API fallback');

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU'; // Русский язык
        utterance.rate = 0.8; // Немного медленнее для лучшей разборчивости
        utterance.pitch = 1;
        utterance.volume = 0.8;

        utterance.onend = () => {
          isPlayingAudio = false;
          updateSpeechButton();
          resolve(true);
        };

        utterance.onerror = (error) => {
          console.error('❌ Web Speech API error:', error);
          isPlayingAudio = false;
          updateSpeechButton();
          resolve(false);
        };

        window.speechSynthesis.speak(utterance);
      } else {
        console.warn('⚠️ Speech synthesis not supported in this browser');
        isPlayingAudio = false;
        updateSpeechButton();
        resolve(false);
      }
    } catch (error) {
      console.error('❌ Error in Web Speech API fallback:', error);
      isPlayingAudio = false;
      updateSpeechButton();
      resolve(false);
    }
  });
}

// Обработчик нажатия кнопки синтеза речи
async function handleSpeechSynthesis() {
  if (speechButton.disabled) return;

  speechButton.disabled = true;
  speechButton.style.opacity = '0.5';

  try {
    const pageData = await getPageContent();
    if (!pageData) {
      addMessage('Не удалось получить контент страницы', false);
      return;
    }

    const summary = createPageSummary(pageData);
    addMessage(`Создаю аудио: ${summary.substring(0, 100)}...`, false);

    const success = await synthesizeSpeech(summary);

    if (success) {
      const method = window.lastSpeechMethod || 'неизвестный метод';
      addMessage(`✅ Аудио воспроизводится (используется ${method})...`, false);
    } else {
      addMessage('❌ Не удалось синтезировать речь. Проверьте подключение к интернету и настройки.', false);
    }
  } catch (error) {
    console.error('Error in speech synthesis process:', error);
    addMessage('Произошла ошибка при обработке страницы', false);
  } finally {
    speechButton.disabled = false;
    speechButton.style.opacity = '1';
  }
}

function handleKeyPress(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}

// Welcome message
addMessage('Добро пожаловать в ИИ-Ассистент! Здесь вы можете спрашивать всё о текущей странице.', false);

// Event listeners
messageInput.addEventListener('keypress', handleKeyPress);
sendButton.addEventListener('click', sendMessage);
speechButton.addEventListener('click', handleSpeechSynthesis);
