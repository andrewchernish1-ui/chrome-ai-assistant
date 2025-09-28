// Content script for extracting page content and form data

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    const pageData = extractPageContent();
    sendResponse(pageData);
  }
});

// Extract page content and form data
function extractPageContent() {
  const title = document.title;
  const url = window.location.href;

  // Extract main text content
  const textContent = extractTextContent();

  // Extract form data
  const forms = extractFormData();

  return {
    title,
    url,
    text: textContent,
    forms
  };
}

// Extract readable text content from the page
function extractTextContent() {
  // Remove script and style elements
  const clonedDoc = document.cloneNode(true);
  const scripts = clonedDoc.querySelectorAll('script, style, nav, header, footer, aside');
  scripts.forEach(element => element.remove());

  // Get text content from main content areas
  const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post', '.entry'];
  let mainContent = '';

  for (const selector of mainSelectors) {
    const element = clonedDoc.querySelector(selector);
    if (element) {
      mainContent = element.textContent.trim();
      break;
    }
  }

  // Fallback to body text if no main content found
  if (!mainContent) {
    mainContent = clonedDoc.body ? clonedDoc.body.textContent.trim() : '';
  }

  // Clean up whitespace
  return mainContent.replace(/\s+/g, ' ').substring(0, 5000); // Limit to 5000 chars
}

// Extract form data from the page
function extractFormData() {
  const forms = document.querySelectorAll('form');
  const formData = [];

  forms.forEach((form, formIndex) => {
    const inputs = form.querySelectorAll('input, textarea, select');
    const formFields = [];

    inputs.forEach(input => {
      const field = {
        name: input.name || input.id || `field_${formIndex}_${Array.from(inputs).indexOf(input)}`,
        type: input.type || 'text',
        label: getFieldLabel(input),
        required: input.required || false,
        value: input.value || ''
      };
      formFields.push(field);
    });

    if (formFields.length > 0) {
      formData.push({
        id: `form_${formIndex}`,
        action: form.action || '',
        method: form.method || 'GET',
        fields: formFields
      });
    }
  });

  return formData;
}

// Get label text for a form field
function getFieldLabel(input) {
  // Check for associated label
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) {
      return label.textContent.trim();
    }
  }

  // Check for parent label
  let parent = input.parentElement;
  while (parent && parent.tagName !== 'FORM') {
    if (parent.tagName === 'LABEL') {
      return parent.textContent.trim();
    }
    parent = parent.parentElement;
  }

  // Check for placeholder
  if (input.placeholder) {
    return input.placeholder;
  }

  // Generate label from name/id
  const name = input.name || input.id;
  if (name) {
    return name.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  return input.type || 'Field';
}

// Initialize content script (no-op placeholder for future enhancements)
