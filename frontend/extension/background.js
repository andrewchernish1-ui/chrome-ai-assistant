// Background service worker for Chrome extension

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('LangGraph AI Agent extension installed');
});

// ElevenLabs API configuration
const ELEVENLABS_API_KEY = 'sk_2b8a35c57d80b445a5198019664c59c2f8ce51fe4436e4cc';
const ELEVENLABS_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    // Get active tab content
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id || !/^https?:/i.test(activeTab.url || '')) {
        // Return empty payload when we can't reach a webpage content script
        sendResponse({
          title: activeTab?.title || '',
          url: activeTab?.url || '',
          text: '',
          forms: []
        });
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { action: 'extractContent' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          if (chrome.runtime.lastError) {
            console.warn('Content script unavailable:', chrome.runtime.lastError.message);
          }

          // Fallback: inject a lightweight script to collect page info
          chrome.scripting.executeScript(
            {
              target: { tabId: activeTab.id },
              func: () => {
                const serializeFormField = (field, index) => ({
                  name: field.name || field.id || `field_${index}`,
                  type: field.type || 'text',
                  label:
                    (field.id && (document.querySelector(`label[for="${field.id}"]`)?.textContent || '').trim()) ||
                    (field.closest('label')?.textContent || '').trim() ||
                    field.placeholder ||
                    field.name ||
                    field.id ||
                    field.type ||
                    'Field',
                  required: Boolean(field.required),
                  value: field.value || ''
                });

                const collectForms = () => {
                  const forms = Array.from(document.querySelectorAll('form'));
                  return forms.slice(0, 5).map((form, formIndex) => {
                    const elements = Array.from(form.querySelectorAll('input, textarea, select'));
                    return {
                      id: form.id || `form_${formIndex}`,
                      action: form.action || '',
                      method: form.method || 'GET',
                      fields: elements.slice(0, 15).map((field, fieldIndex) =>
                        serializeFormField(field, `${formIndex}_${fieldIndex}`)
                      )
                    };
                  });
                };

                const extractText = () => {
                  const clone = document.body ? document.body.cloneNode(true) : null;
                  if (!clone) return '';
                  clone.querySelectorAll('script, style, nav, header, footer, aside').forEach((node) => node.remove());
                  const text = clone.textContent || '';
                  return text.replace(/\s+/g, ' ').trim().slice(0, 5000);
                };

                return {
                  title: document.title,
                  url: window.location.href,
                  text: extractText(),
                  forms: collectForms()
                };
              },
            },
            (results) => {
              if (chrome.runtime.lastError) {
                console.warn('Fallback extraction failed:', chrome.runtime.lastError.message);
                sendResponse({
                  title: activeTab.title || '',
                  url: activeTab.url || '',
                  text: '',
                  forms: []
                });
                return;
              }

              const [result] = results || [];
              sendResponse(
                (result && result.result) || {
                  title: activeTab.title || '',
                  url: activeTab.url || '',
                  text: '',
                  forms: []
                }
              );
            }
          );
          return;
        }

        sendResponse(response);
      });
    });
    return true; // Keep message channel open for async response
  }
  if (request.action === 'openChat') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('chat.html')
    });
  }

  // Обработка синтеза речи через ElevenLabs API
  if (request.action === 'synthesizeSpeech') {
    console.log('🔊 Background script: Starting speech synthesis...');

    synthesizeSpeechElevenLabs(request)
      .then(result => {
        console.log('✅ Background script: Speech synthesis completed');
        sendResponse(result);
      })
      .catch(error => {
        console.error('❌ Background script: Speech synthesis failed:', error);
        sendResponse({
          success: false,
          error: error.message || 'Unknown error occurred'
        });
      });

    return true; // Keep message channel open for async response
  }
});

// Функция синтеза речи через ElevenLabs API
async function synthesizeSpeechElevenLabs(request) {
  try {
    const { text, model_id, voice_settings } = request;

    if (!text || text.trim().length === 0) {
      throw new Error('No text provided for speech synthesis');
    }

    console.log('🔊 Making request to ElevenLabs API for text:', text.substring(0, 50) + '...');

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: text,
        model_id: model_id || 'eleven_multilingual_v2',
        voice_settings: voice_settings || {
          stability: 0.5,
          similarity_boost: 0.5
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ ElevenLabs API error:', response.status, errorText);
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    console.log('✅ ElevenLabs API request successful');

    // Получаем аудио данные как ArrayBuffer
    const audioArrayBuffer = await response.arrayBuffer();

    // Конвертируем в base64 для передачи в content script
    const audioData = btoa(String.fromCharCode(...new Uint8Array(audioArrayBuffer)));

    return {
      success: true,
      audioData: audioData,
      contentType: 'audio/mpeg'
    };

  } catch (error) {
    console.error('❌ Error in synthesizeSpeechElevenLabs:', error);
    throw error;
  }
}
