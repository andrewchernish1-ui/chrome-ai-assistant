// Background service worker for Chrome extension

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('LangGraph AI Agent extension installed');
});

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
});
