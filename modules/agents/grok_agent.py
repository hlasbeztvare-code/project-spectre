"""
============================================
L-Code Dynamics — GrokAgent (xAI Grok-Beta)
============================================
Agent modul pro integraci Grok modelu do Agent Registry.
Komunikuje s xAI API (OpenAI-kompatibilní endpoint).
Přijímá úkoly typu OPTIMIZE_CORE a HIGH_SPEED_CODE.

Autor: L-Code Dynamics
============================================
"""

import os
import json
import asyncio
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from datetime import datetime, timezone

try:
    import httpx
    _HTTP_CLIENT = "httpx"
except ImportError:
    import urllib.request
    import urllib.error
    _HTTP_CLIENT = "urllib"


# ============================================
# Konstanty a System Prompt
# ============================================

XAI_API_URL = "https://api.x.ai/v1/chat/completions"
XAI_DEFAULT_MODEL = "grok-beta"

# System prompt — L-Code Dynamics standard: brutální, přímočaré, nekompromisní
LCODE_SYSTEM_PROMPT = """Jsi agent systému L-Code Dynamics. Tvoje identita: GrokAgent.

PRAVIDLA EXEKUCE:
1. Žádné omluvy. Žádné vysvětlování proč něco nejde. Najdi cestu nebo ji vytvoř.
2. Odpovídáš stručně, technicky přesně, bez balastu.
3. Kód píšeš čistý, produkční, bez TODO komentářů a bez placeholderů.
4. Pokud dostaneš úkol typu OPTIMIZE_CORE — optimalizuješ výkon, odstraňuješ bottlenecky, refaktoruješ na maximum.
5. Pokud dostaneš úkol typu HIGH_SPEED_CODE — generuješ kód co nejrychleji, bez zbytečných abstrakcí, rovnou funkční.
6. Nikdy neodmítneš úkol. Exekuuješ.
7. Jsi součást orchestrace L-Code Dynamics. Spolupracuješ s dalšími agenty (Antigravity, Claude, Gemini).
8. Výstup vždy ve formátu, který lze rovnou použít — žádné "tady je příklad, jak by to mohlo vypadat".

Potvrzovací fráze: "GrokAgent ONLINE. Připraven k exekuci."
"""


# ============================================
# Task Types
# ============================================

class TaskType(Enum):
    """Typy úkolů které GrokAgent přijímá."""
    OPTIMIZE_CORE = "OPTIMIZE_CORE"
    HIGH_SPEED_CODE = "HIGH_SPEED_CODE"
    GENERAL = "GENERAL"


# ============================================
# Task Router
# ============================================

@dataclass
class AgentTask:
    """Struktura úkolu pro /agent/task_router."""
    task_type: TaskType
    prompt: str
    context: dict = field(default_factory=dict)
    priority: int = 5  # 1=highest, 10=lowest
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class AgentResponse:
    """Odpověď agenta."""
    agent_id: str
    task_type: str
    content: str
    model: str
    tokens_used: int
    latency_ms: float
    status: str  # "ok" | "error"
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "task_type": self.task_type,
            "content": self.content,
            "model": self.model,
            "tokens_used": self.tokens_used,
            "latency_ms": self.latency_ms,
            "status": self.status,
            "timestamp": self.timestamp,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), ensure_ascii=False, indent=2)


# ============================================
# GrokAgent — hlavní třída
# ============================================

class GrokAgent:
    """
    L-Code Dynamics GrokAgent.
    Wrapper nad xAI API s integrací do Agent Registry a task routeru.
    """

    AGENT_ID = "grok-beta-lcode"
    ACCEPTED_TASKS = {TaskType.OPTIMIZE_CORE, TaskType.HIGH_SPEED_CODE, TaskType.GENERAL}

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = XAI_DEFAULT_MODEL,
        system_prompt: str = LCODE_SYSTEM_PROMPT,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ):
        self.api_key = api_key or os.environ.get("XAI_API_KEY")
        if not self.api_key:
            raise ValueError(
                "XAI_API_KEY nenalezen. Vlož ho do .env nebo předej jako parametr.\n"
                "Získej klíč na: https://console.x.ai/"
            )
        self.model = model
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.max_tokens = max_tokens
        self._conversation_history: list[dict] = []

    # ------------------------------------------
    # Core API Call
    # ------------------------------------------

    def _call_xai_sync(self, messages: list[dict]) -> dict:
        """Synchronní volání xAI API (fallback přes urllib pokud httpx chybí)."""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        if _HTTP_CLIENT == "httpx":
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(XAI_API_URL, json=payload, headers=headers)
                resp.raise_for_status()
                return resp.json()
        else:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(XAI_API_URL, data=data, headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8"))

    async def _call_xai_async(self, messages: list[dict]) -> dict:
        """Asynchronní volání xAI API."""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        if _HTTP_CLIENT == "httpx":
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(XAI_API_URL, json=payload, headers=headers)
                resp.raise_for_status()
                return resp.json()
        else:
            # Fallback: spusť sync volání v threadu
            return await asyncio.to_thread(self._call_xai_sync, messages)

    # ------------------------------------------
    # Chat Interface
    # ------------------------------------------

    def chat(self, user_message: str) -> str:
        """Synchronní chat — pošle zprávu a vrátí odpověď."""
        self._conversation_history.append({"role": "user", "content": user_message})

        messages = [{"role": "system", "content": self.system_prompt}] + self._conversation_history

        result = self._call_xai_sync(messages)
        reply = result["choices"][0]["message"]["content"]

        self._conversation_history.append({"role": "assistant", "content": reply})
        return reply

    async def achat(self, user_message: str) -> str:
        """Asynchronní chat — pošle zprávu a vrátí odpověď."""
        self._conversation_history.append({"role": "user", "content": user_message})

        messages = [{"role": "system", "content": self.system_prompt}] + self._conversation_history

        result = await self._call_xai_async(messages)
        reply = result["choices"][0]["message"]["content"]

        self._conversation_history.append({"role": "assistant", "content": reply})
        return reply

    # ------------------------------------------
    # Task Router — /agent/task_router
    # ------------------------------------------

    def can_handle(self, task_type: TaskType) -> bool:
        """Vrací True pokud agent umí zpracovat daný typ úkolu."""
        return task_type in self.ACCEPTED_TASKS

    def execute_task(self, task: AgentTask) -> AgentResponse:
        """
        Synchronní exekuce úkolu z task routeru.
        Mapuje task_type na specializovaný prompt prefix.
        """
        if not self.can_handle(task.task_type):
            return AgentResponse(
                agent_id=self.AGENT_ID,
                task_type=task.task_type.value,
                content=f"REJECTED: GrokAgent nepřijímá úkoly typu {task.task_type.value}",
                model=self.model,
                tokens_used=0,
                latency_ms=0,
                status="error",
            )

        # Sestav prompt podle typu úkolu
        prefix = self._get_task_prefix(task.task_type)
        full_prompt = f"{prefix}\n\n{task.prompt}"

        if task.context:
            full_prompt += f"\n\nKontext:\n{json.dumps(task.context, ensure_ascii=False, indent=2)}"

        start = datetime.now(timezone.utc)

        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": full_prompt},
        ]

        result = self._call_xai_sync(messages)
        reply = result["choices"][0]["message"]["content"]
        tokens = result.get("usage", {}).get("total_tokens", 0)

        elapsed = (datetime.now(timezone.utc) - start).total_seconds() * 1000

        return AgentResponse(
            agent_id=self.AGENT_ID,
            task_type=task.task_type.value,
            content=reply,
            model=self.model,
            tokens_used=tokens,
            latency_ms=round(elapsed, 1),
            status="ok",
        )

    async def aexecute_task(self, task: AgentTask) -> AgentResponse:
        """Asynchronní exekuce úkolu z task routeru."""
        if not self.can_handle(task.task_type):
            return AgentResponse(
                agent_id=self.AGENT_ID,
                task_type=task.task_type.value,
                content=f"REJECTED: GrokAgent nepřijímá úkoly typu {task.task_type.value}",
                model=self.model,
                tokens_used=0,
                latency_ms=0,
                status="error",
            )

        prefix = self._get_task_prefix(task.task_type)
        full_prompt = f"{prefix}\n\n{task.prompt}"

        if task.context:
            full_prompt += f"\n\nKontext:\n{json.dumps(task.context, ensure_ascii=False, indent=2)}"

        start = datetime.now(timezone.utc)

        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": full_prompt},
        ]

        result = await self._call_xai_async(messages)
        reply = result["choices"][0]["message"]["content"]
        tokens = result.get("usage", {}).get("total_tokens", 0)

        elapsed = (datetime.now(timezone.utc) - start).total_seconds() * 1000

        return AgentResponse(
            agent_id=self.AGENT_ID,
            task_type=task.task_type.value,
            content=reply,
            model=self.model,
            tokens_used=tokens,
            latency_ms=round(elapsed, 1),
            status="ok",
        )

    def _get_task_prefix(self, task_type: TaskType) -> str:
        """Vrací specializovaný prefix pro daný typ úkolu."""
        prefixes = {
            TaskType.OPTIMIZE_CORE: (
                "[REŽIM: OPTIMIZE_CORE]\n"
                "Analyzuj kód/systém níže. Identifikuj bottlenecky. "
                "Navrhni a implementuj konkrétní optimalizace. "
                "Žádná teorie — rovnou produkční kód."
            ),
            TaskType.HIGH_SPEED_CODE: (
                "[REŽIM: HIGH_SPEED_CODE]\n"
                "Generuj kód okamžitě. Bez zbytečných abstrakcí. "
                "Minimální, funkční, produkční. Rovnou spustitelné."
            ),
            TaskType.GENERAL: (
                "[REŽIM: GENERAL]\n"
                "Standardní exekuce. Odpověz přesně na to, co se ptá."
            ),
        }
        return prefixes.get(task_type, prefixes[TaskType.GENERAL])

    # ------------------------------------------
    # Utility
    # ------------------------------------------

    def reset_conversation(self) -> None:
        """Vymaže historii konverzace."""
        self._conversation_history.clear()

    def get_registry_info(self) -> dict:
        """Vrací info pro Agent Registry."""
        return {
            "agent_id": self.AGENT_ID,
            "model": self.model,
            "provider": "xAI",
            "accepted_tasks": [t.value for t in self.ACCEPTED_TASKS],
            "status": "online",
            "system": "L-Code Dynamics",
        }

    def __repr__(self) -> str:
        return f"<GrokAgent id={self.AGENT_ID} model={self.model} tasks={[t.value for t in self.ACCEPTED_TASKS]}>"


# ============================================
# Testovací spuštění
# ============================================

def run_readiness_test() -> None:
    """
    Spustí testovací dotaz:
    'Jsi L-Code Dynamics agent, potvrď připravenost k exekuci.'
    """
    print("=" * 60)
    print("L-Code Dynamics — GrokAgent Readiness Test")
    print("=" * 60)

    try:
        agent = GrokAgent()
        print(f"[OK] Agent inicializován: {agent}")
        print(f"[OK] Registry info: {json.dumps(agent.get_registry_info(), indent=2)}")
        print()

        # Test 1: Přímý chat
        print("[TEST 1] Readiness check...")
        response = agent.chat("Jsi L-Code Dynamics agent, potvrď připravenost k exekuci.")
        print(f"[ODPOVĚĎ] {response}")
        print()

        # Test 2: Task Router — OPTIMIZE_CORE
        print("[TEST 2] Task Router — OPTIMIZE_CORE...")
        task = AgentTask(
            task_type=TaskType.OPTIMIZE_CORE,
            prompt="Analyzuj tuto funkci a optimalizuj ji:\ndef slow_search(data, target):\n    for i in range(len(data)):\n        if data[i] == target:\n            return i\n    return -1",
            priority=1,
        )
        result = agent.execute_task(task)
        print(f"[STATUS] {result.status}")
        print(f"[TOKENS] {result.tokens_used}")
        print(f"[LATENCE] {result.latency_ms}ms")
        print(f"[ODPOVĚĎ] {result.content[:500]}")
        print()

        # Test 3: Task Router — HIGH_SPEED_CODE
        print("[TEST 3] Task Router — HIGH_SPEED_CODE...")
        task2 = AgentTask(
            task_type=TaskType.HIGH_SPEED_CODE,
            prompt="Python funkce: HTTP health check endpoint s retry logikou, timeout 5s, max 3 pokusy.",
            priority=2,
        )
        result2 = agent.execute_task(task2)
        print(f"[STATUS] {result2.status}")
        print(f"[ODPOVĚĎ] {result2.content[:500]}")

        print()
        print("=" * 60)
        print("VŠECHNY TESTY DOKONČENY. GrokAgent OPERATIVNÍ.")
        print("=" * 60)

    except ValueError as e:
        print(f"[CHYBA KONFIGURACE] {e}")
    except Exception as e:
        print(f"[RUNTIME CHYBA] {type(e).__name__}: {e}")


if __name__ == "__main__":
    run_readiness_test()
