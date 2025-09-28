from fastapi import FastAPI, WebSocket, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json
import uuid
from typing import Dict, Any
from config import Config
from agent import AgentState, process_message
from langchain_core.messages import BaseMessage

# Validate configuration on startup
Config.validate()

app = FastAPI(title="LangGraph AI Agent", version="1.0.0")

# Add CORS middleware for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=Config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session storage (no database for local operation)
sessions: Dict[str, AgentState] = {}

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "LangGraph AI Agent is running"}

@app.post("/chat/{session_id}")
async def chat(session_id: str, request: Request):
    """Process a chat message and return response"""
    try:
        body = await request.json()
        print(f"Received request for session {session_id}: {body}")
        message = body.get('message', '')
        page_content = body.get('page_content', '')
        page_details = body.get('page_details', {})
    except json.JSONDecodeError as e:
        print(f"JSON decode error for session {session_id}: {e}")
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # Get or create session
    if session_id not in sessions:
        sessions[session_id] = AgentState()

    state = sessions[session_id]
    state.page_content = page_content
    state.page_details = page_details

    # Process message
    try:
        result_state = process_message(state, message)
        sessions[session_id] = result_state

        # Get the last AI response
        last_message = result_state.messages[-1] if result_state.messages else None
        if isinstance(last_message, BaseMessage):
            response_content = getattr(last_message, "content", "") or ""
        elif isinstance(last_message, dict):
            response_content = last_message.get('content', '')
        else:
            response_content = str(last_message) if last_message else "No response generated"

        print(f"Generated response for session {session_id}: {response_content[:100]}...")
        return {
            "response": response_content,
            "session_id": session_id,
            "current_tool": result_state.current_tool
        }
    except Exception as e:
        import traceback

        print(f"Error processing message for session {session_id}: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")

@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time status updates"""
    await websocket.accept()

    # Get or create session
    if session_id not in sessions:
        sessions[session_id] = AgentState()

    try:
        while True:
            # Wait for messages from client
            data = await websocket.receive_text()
            message_data = json.loads(data)

            # Update session state
            state = sessions[session_id]
            if "page_content" in message_data:
                state.page_content = message_data["page_content"]
            if "page_details" in message_data:
                state.page_details = message_data["page_details"]

            # Process message if provided
            if "message" in message_data:
                # Send status update
                await websocket.send_json({"status": "thinking", "message": "Processing your request..."})

                try:
                    result_state = process_message(state, message_data["message"])
                    sessions[session_id] = result_state

                    # Send final response
                    last_message = result_state.messages[-1] if result_state.messages else None
                    if isinstance(last_message, BaseMessage):
                        response_content = getattr(last_message, "content", "") or ""
                    elif isinstance(last_message, dict):
                        response_content = last_message.get('content', '')
                    else:
                        response_content = str(last_message) if last_message else "No response generated"

                    await websocket.send_json({
                        "status": "completed",
                        "response": response_content,
                        "current_tool": result_state.current_tool
                    })

                except Exception as e:
                    await websocket.send_json({
                        "status": "error",
                        "message": f"Error: {str(e)}"
                    })

    except Exception as e:
        print(f"WebSocket error: {e}")

@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session information"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    state = sessions[session_id]
    return {
        "session_id": session_id,
        "message_count": len(state.messages),
        "page_content_length": len(state.page_content),
        "has_page_details": bool(state.page_details)
    }

@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session"""
    if session_id in sessions:
        del sessions[session_id]
        return {"message": "Session deleted"}
    else:
        raise HTTPException(status_code=404, detail="Session not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=Config.HOST, port=Config.PORT)
