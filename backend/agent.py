from dataclasses import dataclass, field
from typing import Dict, Any, List, Optional
import json
import re
import google.generativeai as genai
from google.protobuf.json_format import MessageToDict
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
from langgraph.graph import StateGraph, START, END
from config import Config
from tools import ExaResearcher

# Configure Gemini
genai.configure(api_key=Config.GEMINI_API_KEY)

@dataclass
class AgentState:
    """Manages conversation state with messages and page context"""
    messages: List[BaseMessage] = field(default_factory=list)
    page_content: str = ""
    page_details: Dict[str, Any] = field(default_factory=dict)
    current_tool: Optional[str] = None

GEMINI_TOOLS = [
    {
        "function_declarations": [
            {
                "name": "exa_researcher",
                "description": "Ищи свежие сведения в интернете через платформу Exa и возвращай найденные данные.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "query": {
                            "type": "STRING",
                            "description": "Запрос для поиска — например, вопрос пользователя или ключевые слова."
                        },
                        "context": {
                            "type": "STRING",
                            "description": "Дополнительный контекст из текущей страницы для уточнения поиска."
                        },
                    },
                    "required": ["query"],
                },
            }
        ]
    }
]

INSTRUCTION_METADATA_KEY = "__instruction_message__"


def clean_markdown(text: str) -> str:
    """Remove common Markdown formatting from text"""
    # Remove bold/italic markers
    text = re.sub(r'\*\*+', '', text)  # Remove ** and ***
    text = re.sub(r'\*+', '', text)  # Remove remaining *
    # Remove list markers: - 
    text = re.sub(r'^\s*-\s*', '', text, flags=re.MULTILINE)
    # Remove numbered lists
    text = re.sub(r'^\s*\d+\.\s*', '', text, flags=re.MULTILINE)
    # Remove headers: #
    text = re.sub(r'^\s*#+\s*', '', text, flags=re.MULTILINE)
    # Remove links: [text](url) -> text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Clean up extra spaces
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    return text


def ensure_instruction_message(state: "AgentState") -> None:
    """Вставляет системную инструкцию для модели, если её ещё нет."""
    has_instruction = any(
        isinstance(message, SystemMessage)
        and message.additional_kwargs.get(INSTRUCTION_METADATA_KEY)
        for message in state.messages
    )

    if not has_instruction:
        instruction = SystemMessage(
            content=(
                "Ты — LangGraph AI Assistant. Отвечай на вопросы пользователя по-русски, кратко и по делу. "
                "НИКОГДА не используй Markdown-разметку, такую как *, **, -, #, [ссылки](url) и т.д. "
                "Используй только чистый текст без каких-либо символов форматирования. "
                "Для списков или структурированных данных используй чистый текст в формате: Название: ..., Описание: ..., Веб-сайт: ... "
                "Примеры правильного формата: "
                "Название школы: Schoolism "
                "Веб-сайт: https://schoolism.com "
                "Описание: онлайн-курсы для развития навыков в области искусства. "
                "Если для точного ответа нужны свежие данные или дополнительные источники, вызови функцию "
                "exa_researcher, передав объект с ключами \"query\" (формулировка запроса) и \"context\" "
                "(релевантная выдержка из страницы, если она есть). После получения результатов внимательно "
                "проанализируй их и составь итоговый ответ в чистом тексте без Markdown."
            ),
            additional_kwargs={INSTRUCTION_METADATA_KEY: True},
        )
        state.messages.insert(0, instruction)


class GeminiLLM:
    """Gemini LLM wrapper with tool calling support"""

    def __init__(self, model_name: str = "gemini-2.5-flash", temperature: float = 0.7):
        self.model = genai.GenerativeModel(model_name)
        self.temperature = temperature

    def invoke(self, messages: List[BaseMessage]) -> AIMessage:
        """Process messages and return AI response"""
        contents: List[Dict[str, Any]] = []

        for msg in messages:
            if isinstance(msg, HumanMessage):
                contents.append({
                    "role": "user",
                    "parts": [{"text": msg.content}]
                })
            elif isinstance(msg, AIMessage):
                parts: List[Dict[str, Any]] = []
                if msg.content:
                    parts.append({"text": str(msg.content)})

                for tool_call in msg.tool_calls or []:
                    args = tool_call.get("args") or {}
                    if not isinstance(args, dict):
                        args = dict(args)
                    parts.append({
                        "function_call": {
                            "name": tool_call.get("name", ""),
                            "args": args,
                        }
                    })

                if not parts:
                    parts.append({"text": ""})

                contents.append({
                    "role": "model",
                    "parts": parts,
                })
            elif isinstance(msg, SystemMessage):
                contents.append({
                    "role": "user",
                    "parts": [{"text": f"Context for the assistant:\n{msg.content}"}]
                })
            elif isinstance(msg, ToolMessage):
                contents.append({
                    "role": "user",
                    "parts": [{"text": f"Результат инструмента: {msg.content}"}]
                })

        # Get the last user message
        last_user_msg = None
        for msg in reversed(messages):
            if isinstance(msg, HumanMessage):
                last_user_msg = msg.content
                break

        if not last_user_msg:
            last_user_msg = "Hello"

        # Send message
        try:
            print("[GeminiLLM] Invoking Gemini with payload:")
            print(json.dumps({
                "contents": contents,
                "tools": GEMINI_TOOLS,
            }, ensure_ascii=False)[:4000])
        except Exception:
            pass

        try:
            response = self.model.generate_content(
                contents=contents,
                tools=GEMINI_TOOLS,
                generation_config={"temperature": self.temperature}
            )
        except Exception as exc:
            import traceback

            print(f"[GeminiLLM] generate_content raised: {exc}")
            traceback.print_exc()
            raise

        try:
            response_dump = getattr(response, "to_dict", None)
            if callable(response_dump):
                serialized = response_dump()
            else:
                serialized = json.loads(response.model_dump_json()) if hasattr(response, "model_dump_json") else str(response)
            print("[GeminiLLM] Raw response:")
            print(json.dumps(serialized, ensure_ascii=False)[:4000])
        except Exception as exc:
            print(f"[GeminiLLM] Failed to serialize response: {exc}")

        # Check for function calls in response
        tool_calls = []
        response_text = ""
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
                for index, part in enumerate(candidate.content.parts):
                    function_call_part = getattr(part, 'function_call', None) or getattr(part, 'functionCall', None)
                    if function_call_part:
                        call_name = getattr(function_call_part, 'name', '')
                        raw_args = getattr(function_call_part, 'args', None)
                        if raw_args:
                            if hasattr(raw_args, "ListFields"):
                                call_args = MessageToDict(raw_args)
                            elif hasattr(raw_args, "items"):
                                call_args = {key: value for key, value in raw_args.items()}
                            else:
                                call_args = dict(raw_args)
                        else:
                            call_args = {}
                        call_id = f"{call_name}_{index}"
                        tool_calls.append({
                            "id": call_id,
                            "name": call_name,
                            "args": call_args,
                        })

                text_parts: List[str] = []
                for part in candidate.content.parts:
                    text_value = getattr(part, "text", None)
                    if text_value:
                        text_parts.append(text_value)
                if text_parts:
                    response_text = "\n".join(text_parts)

        if not response_text:
            try:
                response_text = getattr(response, "text", "") or ""
            except (ValueError, AttributeError):
                response_text = ""

        # Clean any remaining Markdown formatting
        response_text = clean_markdown(response_text)

        return AIMessage(
            content=response_text,
            tool_calls=tool_calls
        )


def create_agent() -> StateGraph:
    """Creates LangGraph agent with Gemini and tools"""
    llm = GeminiLLM(model_name=Config.GEMINI_MODEL, temperature=0.7)

    # Define tools
    tools = [ExaResearcher()]
    tool_map = {tool.name: tool for tool in tools}

    CONTEXT_METADATA_KEY = "__context_message__"

    def update_context_message(state: AgentState) -> None:
        """Ensure system context message reflects latest page content details"""
        context_sections: List[str] = []

        if state.page_content:
            context_sections.append(
                "Current page content (truncated to 5000 chars):\n" + state.page_content[:5000]
            )

        # Include additional metadata if available
        if state.page_details.get("url") and state.page_details.get("title"):
            context_sections.append(
                "Page metadata:\n" + json.dumps(
                    {
                        "title": state.page_details.get("title"),
                        "url": state.page_details.get("url"),
                    },
                    ensure_ascii=False,
                )
            )

        if state.page_details.get("forms"):
            forms = state.page_details["forms"]
            summarized_forms = []
            for form in forms[:3]:
                fields = form.get("fields", [])
                field_summaries = [
                    f"- {field.get('label') or field.get('name') or 'Unnamed'} ({field.get('type', 'text')})"
                    for field in fields[:5]
                ]
                summarized_forms.append(
                    "Form "
                    + (form.get("id") or form.get("action") or "unknown")
                    + "\n"
                    + "\n".join(field_summaries)
                )

            if summarized_forms:
                context_sections.append(
                    "Detected form structure (partial):\n" + "\n\n".join(summarized_forms)
                )

        context_text = "\n\n".join(context_sections)

        # Find existing context system message
        context_index = next(
            (
                idx
                for idx, message in enumerate(state.messages)
                if isinstance(message, SystemMessage)
                and message.additional_kwargs.get(CONTEXT_METADATA_KEY)
            ),
            None,
        )

        if context_text:
            context_message = SystemMessage(
                content=context_text,
                additional_kwargs={CONTEXT_METADATA_KEY: True},
            )

            if context_index is not None:
                state.messages[context_index] = context_message
            else:
                state.messages.insert(0, context_message)
        elif context_index is not None:
            state.messages.pop(context_index)

    def agent_node(state: AgentState) -> AgentState:
        """Main agent processing node"""
        update_context_message(state)
        print("[LangGraph] Agent node state messages before LLM:")
        try:
            for idx, msg in enumerate(state.messages):
                print(f"  [{idx}] {type(msg).__name__}: {getattr(msg, 'content', '')}")
        except Exception:
            pass
        response = llm.invoke(state.messages)
        state.messages.append(response)
        print("[LangGraph] Agent node appended AIMessage with tool_calls:", getattr(response, 'tool_calls', None))
        return state

    def tool_node(state: AgentState) -> AgentState:
        """Tool execution node"""
        last_message = state.messages[-1]
        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            for tool_call in last_message.tool_calls:
                tool_name = tool_call["name"]
                tool_args = tool_call["args"]

                state.current_tool = tool_name

                if tool_name in tool_map:
                    tool = tool_map[tool_name]
                    # Call the appropriate method based on tool
                    if tool_name == "exa_researcher":
                        result = tool.research(
                            query=tool_args.get("query", ""),
                            context=tool_args.get("context") or state.page_content
                        )
                    else:
                        result = f"Unknown tool: {tool_name}"
                else:
                    result = f"Tool not found: {tool_name}"

                # Add tool result as a tool message
                tool_message = ToolMessage(
                    content=str(result),
                    tool_call_id=tool_call.get("id", f"{tool_name}_{len(state.messages)}")  # Preserve original tool call id
                )
                state.messages.append(tool_message)
                print("[LangGraph] Tool node executed", tool_name, "result preview:", str(result)[:200])

        state.current_tool = None
        return state

    # Create the graph
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", tool_node)

    # Add edges
    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges(
        "agent",
        lambda state: "tools" if (isinstance(state.messages[-1], AIMessage) and state.messages[-1].tool_calls) else END,
        {"tools": "tools", END: END}
    )
    workflow.add_edge("tools", "agent")

    return workflow.compile()


def process_message(state: AgentState, message: str) -> AgentState:
    """Processes user messages and updates state"""
    ensure_instruction_message(state)

    # Add user message to state
    human_message = HumanMessage(content=message)
    state.messages.append(human_message)
    print("[process_message] Added HumanMessage:", message)

    # Process through the agent
    agent = create_agent()
    print("[process_message] Invoking agent with", len(state.messages), "messages")
    result_dict = agent.invoke(state)
    print("[process_message] Agent returned keys:", list(result_dict.keys()))

    # Update state from the result dictionary
    state.messages = result_dict.get('messages', state.messages)
    state.page_content = result_dict.get('page_content', state.page_content)
    state.page_details = result_dict.get('page_details', state.page_details)
    state.current_tool = result_dict.get('current_tool', state.current_tool)

    return state
