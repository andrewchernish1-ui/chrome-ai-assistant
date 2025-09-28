// Popup script - opens the chat interface in the side panel
document.addEventListener('DOMContentLoaded', function() {
  // Open side panel
  chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });

  // Close popup
  window.close();
});
