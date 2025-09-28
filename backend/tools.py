import json
from typing import Any, Dict, List

import requests
from langchain_core.tools import BaseTool
from pydantic import ConfigDict

from config import Config


EXA_ANSWER_URL = "https://api.exa.ai/answer"
MAX_CONTEXT_CHARS = 4000


class ExaResearcher(BaseTool):
    """Tool for research using the Exa API"""

    name: str = "exa_researcher"
    description: str = "Perform web research using the Exa /answer endpoint and return citations"

    model_config = ConfigDict(arbitrary_types_allowed=True)

    def __init__(self, **data: Any):
        super().__init__(**data)
        session = requests.Session()
        session.headers.update(
            {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "x-api-key": Config.EXA_API_KEY or "",
            }
        )
        object.__setattr__(self, "_session", session)

    def _run(self, query: str, context: str = "") -> str:
        return self.research(query, context)

    def research(self, query: str, context: str = "") -> str:
        if not Config.EXA_API_KEY:
            return "EXA API key is missing — set EXA_API_KEY in your environment."

        clean_query = (query or "").strip()
        if not clean_query:
            return "EXA search: пустой запрос."

        context_snippet = (context or "").strip()
        if context_snippet:
            context_snippet = context_snippet[:MAX_CONTEXT_CHARS]
            clean_query = f"{clean_query}\n\nContext:\n{context_snippet}"

        payload: Dict[str, Any] = {
            "query": clean_query,
            "text": True,
            "stream": False,
        }

        try:
            response = self._session.post(EXA_ANSWER_URL, data=json.dumps(payload), timeout=40)
        except requests.RequestException as exc:
            return f"EXA API request failed: {exc}"

        if response.status_code >= 400:
            return (
                f"EXA API error {response.status_code}: "
                f"{response.text.strip() or 'Unknown error'}"
            )

        try:
            data: Dict[str, Any] = response.json()
        except ValueError as exc:
            return f"EXA API returned invalid JSON: {exc}"

        answer = data.get("answer") or ""
        citations: List[Dict[str, Any]] = data.get("citations") or []
        cost_info = data.get("costDollars") or {}

        parts: List[str] = []
        if answer:
            parts.append(f"Answer:\n{answer.strip()}")
        if citations:
            citation_lines = []
            for idx, item in enumerate(citations, start=1):
                title = item.get("title") or item.get("url") or "Без названия"
                url = item.get("url") or item.get("id") or ""
                snippet = item.get("text") or ""
                citation_line = f"{idx}. {title}"
                if url:
                    citation_line += f" — {url}"
                if snippet:
                    citation_line += f"\n    {snippet[:280].strip()}"
                citation_lines.append(citation_line)
            parts.append("Citations:\n" + "\n".join(citation_lines))
        if cost_info:
            total = cost_info.get("total")
            if total is not None:
                parts.append(f"Estimated cost: ${total}")

        return "\n\n".join(parts).strip() or "EXA API вернула пустой ответ."
