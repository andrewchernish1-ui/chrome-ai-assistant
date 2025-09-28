const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

// Generate session ID if not exists
let sessionId = localStorage.getItem('aiAssistantSessionId');
if (!sessionId) {
  sessionId = crypto.randomUUID();
  localStorage.setItem('aiAssistantSessionId', sessionId);
}

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
    const response = await chrome.runtime.sendMessage({ action: 'getPageContent' });

    // Create compressed human-readable summary
    const pageContent = `Page Title: ${response.title}
URL: ${response.url}
Content: ${response.text.replace(/\s+/g, ' ').slice(0, 3000)}
Forms: ${response.forms.map(form => `${form.id}: ${form.fields.map(f => `${f.label || f.name}`).join(', ')}`).join('; ')}`;

    return {
      summarized: pageContent,
      details: response
    };
  } catch (error) {
    console.warn('Failed to get page content:', error);
    return {
      summarized: '',
      details: {}
    };
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
    addMessage(data.response, false);
  } catch (error) {
    console.error('Error:', error);
    addMessage('Error connecting to AI assistant. Please try again.', false);
  } finally {
    sendButton.disabled = false;
  }
}

function handleKeyPress(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}

// Welcome message
addMessage('Welcome to AI Assistant! Ask me anything about the current webpage.', false);

// Event listeners
messageInput.addEventListener('keypress', handleKeyPress);
sendButton.addEventListener('click', sendMessage);
