# LangGraph Chrome AI Agent Extension

Chrome extension with LangGraph-powered AI assistant that can interact with web page content and use external tools like Exa API for research.

## Features

- **Chat Interface**: Minimalistic AI chat interface powered by Gemini Flash 2.5
- **Page Context**: Extract and analyze content from current web pages
- **External Tools**: Integration with Exa API for web research
- **Real-time Updates**: WebSocket support for live status updates
- **Side Panel UI**: Modern chat interface using Shadcn components

## Architecture

### Backend (Python/FastAPI)
- `main.py` - FastAPI server with WebSocket endpoints
- `agent.py` - LangGraph agent with Gemini LLM wrapper
- `tools.py` - ExaResearcher tool for web search
- `config.py` - Configuration and validation

### Frontend (Chrome Extension)
- Manifest V3 with side panel architecture
- React chat UI with Shadcn components
- Content script for page extraction
- Background service worker for messaging

## Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 18+
- Chrome browser
- API keys for Gemini and Exa

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Unix/MacOS:
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp ../.env.example .env
# Edit .env with your API keys
```

5. Run the backend:
```bash
python main.py
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Load in Chrome:
- Open `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select the `dist` folder

## Usage

1. Open any webpage
2. Click the extension icon to open side panel
3. Ask questions about the page content
4. The AI will use page context and external tools as needed

## API Endpoints

- `GET /` - Health check
- `POST /chat/{session_id}` - Send chat message
- `WebSocket /ws/{session_id}` - Real-time communication
- `GET /sessions/{session_id}` - Get session info
- `DELETE /sessions/{session_id}` - Delete session

## Configuration

Environment variables:
- `GEMINI_API_KEY` - Google Gemini API key
- `EXA_API_KEY` - Exa API key
- `HOST` - Server host (default: localhost)
- `PORT` - Server port (default: 8000)

## Development

### Adding New Tools
1. Create tool class in `backend/tools.py`
2. Add to `GEMINI_TOOLS` configuration
3. Update `tool_map` in `create_agent()`

### Customizing UI
- Modify components in `frontend/src/components/`
- Update styles in `frontend/src/index.css`
- Configure Shadcn in `frontend/` directory

## Troubleshooting

### Common Issues

1. **Extension not loading**
   - Ensure all files exist in correct paths per manifest.json
   - Check Chrome developer console for errors

2. **API connection failed**
   - Verify backend is running on correct port
   - Check CORS settings in config.py
   - Ensure .env file is properly configured

3. **Tool calls failing**
   - Check API keys are valid
   - Verify network connectivity
   - Review tool implementation in tools.py

### Build Issues
- Post-build scripts copy all necessary extension files to dist/
- Vite outputs to root of dist directory
- Static files like manifest.json are copied manually

## Security Notes

- API keys stored in environment variables
- CORS configured for Chrome extension only
- All external API calls validated
- No sensitive data stored in extension

## License

MIT License
