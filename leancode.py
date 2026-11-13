"""
LeanCode: High-Efficiency, Token-Optimized Coding Agent
Powered by Maxim AI's Bifrost Gateway (http://localhost:8080/openai/v1)

Problem Statement 01: "Build a Coding Agent That Gets the Job Done on the Fewest Tokens"
"""

import os
import sys
import json
import time
import hashlib
import fnmatch
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable, Tuple
from dataclasses import dataclass, field, asdict

import tiktoken
from dotenv import load_dotenv
from openai import OpenAI, APIError, RateLimitError, APIConnectionError, InternalServerError

# Load environment variables
load_dotenv()


# ==========================================
# CONFIGURATION & PRICING
# ==========================================

# Default estimated pricing per 1K tokens in USD
MODEL_PRICING: Dict[str, Dict[str, float]] = {
    "openai/gpt-4o-mini": {"prompt": 0.00015, "completion": 0.00060},
    "openai/gpt-4o": {"prompt": 0.00250, "completion": 0.01000},
    "anthropic/claude-3-5-sonnet-20241022": {"prompt": 0.00300, "completion": 0.01500},
    "anthropic/claude-3-haiku-20240307": {"prompt": 0.00025, "completion": 0.00125},
    "ollama/qwen2.5-coder:7b": {"prompt": 0.0, "completion": 0.0},  # Local Ollama is free!
    "default": {"prompt": 0.00050, "completion": 0.00150},
}


@dataclass
class LeanCodeConfig:
    """Runtime configuration for LeanCode engine."""
    bifrost_base_url: str = os.getenv("BIFROST_BASE_URL", "http://localhost:8080/openai/v1")
    bifrost_virtual_key: str = os.getenv("BIFROST_VIRTUAL_KEY", "sk-bf-your-key")
    primary_model: str = os.getenv("PRIMARY_MODEL", "openai/gpt-4o-mini")
    fallback_models: List[str] = field(default_factory=lambda: [
        m.strip() for m in os.getenv(
            "FALLBACK_MODELS",
            "anthropic/claude-3-5-sonnet-20241022,ollama/qwen2.5-coder:7b"
        ).split(",") if m.strip()
    ])
    local_confidential_model: str = os.getenv("LOCAL_CONFIDENTIAL_MODEL", "ollama/qwen2.5-coder:7b")
    user_budget_usd: float = float(os.getenv("USER_BUDGET_USD", "0.25"))
    workspace_root: Path = field(default_factory=lambda: Path(os.getenv("WORKSPACE_ROOT", ".")).resolve())
    confidential_override: Optional[bool] = None

    def is_confidential(self) -> bool:
        """
        Check if confidential mode is active.
        Physical OS-level marker file '.confidential' OR CONFIDENTIAL_REPO=true env var.
        """
        if self.confidential_override is not None:
            return self.confidential_override
        marker_file = self.workspace_root / ".confidential"
        if marker_file.exists():
            return True
        env_val = os.getenv("CONFIDENTIAL_REPO", "").lower().strip()
        return env_val in ("1", "true", "yes", "on")


# ==========================================
# EXCEPTIONS
# ==========================================

class LeanCodeError(Exception):
    """Base exception for LeanCode engine."""
    pass


class BudgetExceededError(LeanCodeError):
    """Raised when pre-call or actual spend exceeds USER_BUDGET_USD."""
    pass


class BifrostPaymentRequiredError(LeanCodeError):
    """Raised when Bifrost Gateway reports HTTP 402 or virtual key budget exhaustion."""
    pass


class ActionDeniedError(LeanCodeError):
    """Raised when user denies approval for write_file or run_shell."""
    pass


# ==========================================
# TELEMETRY & CACHE MODELS
# ==========================================

@dataclass
class FileCacheRecord:
    sha256: str
    mtime: float
    size: int
    line_count: int
    estimated_tokens: int
    line_ranges_read: Dict[str, str] = field(default_factory=dict)  # "start:end" -> sha256


@dataclass
class Telemetry:
    task_id: str
    active_model: str = ""
    confidential_locked: bool = False
    tokens_prompt: int = 0
    tokens_completion: int = 0
    tokens_total: int = 0
    tokens_saved_by_cache: int = 0
    cache_hits: int = 0
    total_spend_usd: float = 0.0
    budget_cap_usd: float = 0.25
    failover_events: List[Dict[str, Any]] = field(default_factory=list)
    action_audit_log: List[Dict[str, Any]] = field(default_factory=list)
    status: str = "INITIALIZED"  # INITIALIZED, RUNNING, COMPLETED, BUDGET_HALTED, FAILED

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ==========================================
# TOOL DEFINITIONS FOR OPENAI SDK
# ==========================================

LEANCODE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List files and directories in the workspace to navigate structure without dumping file contents.",
            "parameters": {
                "type": "object",
                "properties": {
                    "directory": {
                        "type": "string",
                        "description": "Subdirectory to inspect relative to workspace root (defaults to '.')."
                    },
                    "max_depth": {
                        "type": "integer",
                        "description": "Maximum depth to recurse (defaults to 3)."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_code",
            "description": "Search code across files using substring or regex matching (grep-style). Returns only matched lines with line numbers, saving thousands of tokens over reading entire files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query or regex pattern."
                    },
                    "file_pattern": {
                        "type": "string",
                        "description": "Glob filter (e.g. '*.py', '*.ts', '*.js'). Defaults to all code files."
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of matching lines to return (defaults to 30)."
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read a file with optional line-range slicing. Implements SHA-256 caching: if the file/slice hasn't changed since last read, returns a cache-hit summary instead of dumping tokens.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "File path relative to workspace root."
                    },
                    "start_line": {
                        "type": "integer",
                        "description": "1-indexed starting line number (optional, for slicing)."
                    },
                    "end_line": {
                        "type": "integer",
                        "description": "1-indexed ending line number (optional, for slicing)."
                    }
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write or overwrite a file with given content. SENSITIVE: Requires explicit human approval gate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Destination file path relative to workspace root."
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to write into the file."
                    }
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_shell",
            "description": "Run a shell or git command in the workspace directory. SENSITIVE: Requires explicit human approval gate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "Shell command to execute (e.g., 'pytest', 'git status', 'python app.py')."
                    },
                    "timeout_seconds": {
                        "type": "integer",
                        "description": "Max seconds to wait before timeout (defaults to 30)."
                    }
                },
                "required": ["command"]
            }
        }
    }
]


# ==========================================
# LEANCODE CORE ENGINE
# ==========================================

class LeanCodeEngine:
    """
    LeanCode Core Execution Engine.
    Routes through Bifrost Gateway, minimizes tokens with SHA-256 caching and slicing,
    enforces strict OS-level privacy locks, pre-call budget checks, and human approval gates.
    """

    def __init__(
        self,
        config: Optional[LeanCodeConfig] = None,
        approval_handler: Optional[Callable[[str, Dict[str, Any]], bool]] = None,
        client: Optional[OpenAI] = None
    ):
        self.config = config or LeanCodeConfig()
        self.approval_handler = approval_handler or self._cli_approval_gate
        self.workspace_root = self.config.workspace_root

        # Initialize OpenAI Client pointed to Bifrost Gateway
        self.client = client or OpenAI(
            base_url=self.config.bifrost_base_url,
            api_key=self.config.bifrost_virtual_key,
        )

        # File hash cache: path_str -> FileCacheRecord
        self.file_hash_cache: Dict[str, FileCacheRecord] = {}

        # Tokenizer for pre-call budgeting and savings estimation
        try:
            self.tokenizer = tiktoken.get_encoding("cl100k_base")
        except Exception:
            self.tokenizer = None

        # Telemetry
        self.telemetry = Telemetry(
            task_id=f"lc_{int(time.time()*1000)}",
            budget_cap_usd=self.config.user_budget_usd
        )

        # Pending actions awaiting server approval
        self.pending_actions: Dict[str, Dict[str, Any]] = {}

    # ----------------------------------------------------
    # TOKEN ESTIMATION & BUDGET MANAGEMENT
    # ----------------------------------------------------

    def count_tokens(self, text: str) -> int:
        """Estimate token count using tiktoken or 4-chars/token heuristic."""
        if not text:
            return 0
        if self.tokenizer:
            try:
                return len(self.tokenizer.encode(text))
            except Exception:
                pass
        return max(1, len(text) // 4)

    def estimate_messages_tokens(self, messages: List[Dict[str, Any]]) -> int:
        """Estimate total tokens in chat messages plus tool schemas."""
        total = 0
        for msg in messages:
            content = msg.get("content") or ""
            total += self.count_tokens(str(content)) + 4  # message envelope overhead
            if "tool_calls" in msg and msg["tool_calls"]:
                for tc in msg["tool_calls"]:
                    fn = tc.get("function", {})
                    total += self.count_tokens(fn.get("name", ""))
                    total += self.count_tokens(fn.get("arguments", ""))
        # Include tool schema definitions overhead (~400 tokens)
        total += 450
        return total

    def get_pricing_for_model(self, model: str) -> Dict[str, float]:
        """Fetch pricing rates for a given model."""
        if model in MODEL_PRICING:
            return MODEL_PRICING[model]
        for key, price in MODEL_PRICING.items():
            if key.split("/")[-1] in model:
                return price
        # If local ollama model, cost is zero
        if "ollama" in model.lower() or "local" in model.lower():
            return {"prompt": 0.0, "completion": 0.0}
        return MODEL_PRICING["default"]

    def estimate_call_cost(self, prompt_tokens: int, estimated_completion_tokens: int, model: str) -> float:
        """Estimate cost of an upcoming LLM call in USD."""
        pricing = self.get_pricing_for_model(model)
        cost_prompt = (prompt_tokens / 1000.0) * pricing["prompt"]
        cost_comp = (estimated_completion_tokens / 1000.0) * pricing["completion"]
        return cost_prompt + cost_comp

    def check_pre_call_budget(self, messages: List[Dict[str, Any]], model: str) -> float:
        """
        Enforce pre-call budget check.
        If current spend + estimated call cost > USER_BUDGET_USD, raise BudgetExceededError.
        """
        prompt_tokens = self.estimate_messages_tokens(messages)
        # Assume expected completion tokens (~500 tokens default)
        est_cost = self.estimate_call_cost(prompt_tokens, 500, model)
        projected_spend = self.telemetry.total_spend_usd + est_cost

        if projected_spend > self.config.user_budget_usd:
            self.telemetry.status = "BUDGET_HALTED"
            err_msg = (
                f"[BUDGET ENFORCEMENT] Pre-call token estimation (${projected_spend:.5f}) "
                f"exceeds USER_BUDGET_USD cap (${self.config.user_budget_usd:.5f}). "
                f"Execution cleanly halted to prevent budget overrun."
            )
            self._log_event("budget_halt", {"projected_spend": projected_spend, "cap": self.config.user_budget_usd})
            raise BudgetExceededError(err_msg)

        return est_cost

    # ----------------------------------------------------
    # CODE PRIVACY & PROMPT-INJECTION IMMUNITY
    # ----------------------------------------------------

    def get_candidate_models(self) -> List[str]:
        """
        Determine model fallback chain.
        PHYSICALLY IMMUNE TO PROMPT INJECTION:
        Checks OS-level marker file or CONFIDENTIAL_REPO env var BEFORE building request.
        If confidential, cloud models are stripped at the Python routing level.
        """
        is_conf = self.config.is_confidential()
        self.telemetry.confidential_locked = is_conf

        if is_conf:
            # Physical lock: only local confidential model is allowed!
            self._log_event("confidential_lock", {
                "reason": "OS-level .confidential marker or CONFIDENTIAL_REPO=true detected",
                "locked_model": self.config.local_confidential_model,
                "stripped_cloud_models": [self.config.primary_model] + self.config.fallback_models
            })
            return [self.config.local_confidential_model]

        # Normal mode: primary model + fallbacks
        models = [self.config.primary_model]
        for fb in self.config.fallback_models:
            if fb not in models:
                models.append(fb)
        return models

    # ----------------------------------------------------
    # TOKEN-MINIMIZING TOOL IMPLEMENTATIONS
    # ----------------------------------------------------

    def _resolve_safe_path(self, rel_path: str) -> Path:
        """Resolve path and ensure it is strictly within workspace_root."""
        path = (self.workspace_root / rel_path).resolve()
        try:
            path.relative_to(self.workspace_root.resolve())
        except ValueError:
            raise LeanCodeError(f"Security Violation: Path '{rel_path}' attempts directory traversal outside workspace root.")
        return path

    def _compute_sha256(self, content_bytes: bytes) -> str:
        """Compute SHA-256 hash."""
        return hashlib.sha256(content_bytes).hexdigest()

    def tool_list_files(self, directory: str = ".", max_depth: int = 3) -> str:
        """List directory files compactly without dumping content."""
        target_dir = self._resolve_safe_path(directory)
        if not target_dir.exists():
            return f"Error: Directory '{directory}' does not exist."

        ignore_dirs = {".git", ".venv", "venv", "__pycache__", "node_modules", ".next", ".pytest_cache", ".gemini"}
        tree_lines = []

        def walk(current: Path, depth: int, prefix: str = ""):
            if depth > max_depth:
                return
            try:
                entries = sorted(current.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
            except PermissionError:
                return

            for idx, entry in enumerate(entries):
                if entry.name in ignore_dirs:
                    continue
                is_last = (idx == len(entries) - 1)
                connector = "└── " if is_last else "├── "
                sub_prefix = "    " if is_last else "│   "

                if entry.is_dir():
                    tree_lines.append(f"{prefix}{connector}{entry.name}/")
                    walk(entry, depth + 1, prefix + sub_prefix)
                else:
                    size = entry.stat().st_size
                    tree_lines.append(f"{prefix}{connector}{entry.name} ({size} B)")

        walk(target_dir, 1)
        if not tree_lines:
            return f"Directory '{directory}' is empty."
        return "\n".join(tree_lines)

    def tool_search_code(self, query: str, file_pattern: str = "*", max_results: int = 30) -> str:
        """
        Search code across workspace using grep-style scanning.
        Returns line numbers and matched snippets, saving whole-file reading.
        """
        ignore_dirs = {".git", ".venv", "venv", "__pycache__", "node_modules", ".next", ".pytest_cache", ".gemini"}
        matches = []

        for root, dirs, files in os.walk(self.workspace_root):
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            for file_name in files:
                if file_pattern != "*" and not fnmatch.fnmatch(file_name, file_pattern):
                    continue
                file_path = Path(root) / file_name
                try:
                    rel_path = file_path.relative_to(self.workspace_root)
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        lines = f.readlines()
                    for line_idx, line in enumerate(lines, start=1):
                        if query.lower() in line.lower():
                            snippet = line.strip()
                            matches.append(f"{rel_path}:{line_idx}: {snippet}")
                            if len(matches) >= max_results:
                                break
                except Exception:
                    continue
                if len(matches) >= max_results:
                    break
            if len(matches) >= max_results:
                break

        if not matches:
            return f"No occurrences of '{query}' found matching pattern '{file_pattern}'."
        header = f"Found {len(matches)} match(es) for '{query}':\n"
        return header + "\n".join(matches)

    def tool_read_file(self, path: str, start_line: Optional[int] = None, end_line: Optional[int] = None) -> str:
        """
        Read file with line-range slicing and SHA-256 caching.
        Returns [CACHE HIT — saved ~N tokens] when file/range is unchanged.
        """
        file_path = self._resolve_safe_path(path)
        if not file_path.exists():
            return f"Error: File '{path}' does not exist."
        if not file_path.is_file():
            return f"Error: '{path}' is not a regular file."

        try:
            raw_bytes = file_path.read_bytes()
        except Exception as e:
            return f"Error reading file '{path}': {str(e)}"

        curr_sha256 = self._compute_sha256(raw_bytes)
        curr_mtime = file_path.stat().st_mtime
        curr_size = len(raw_bytes)

        # Decode lines
        try:
            content = raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            content = raw_bytes.decode("latin-1", errors="replace")

        lines = content.splitlines(keepends=True)
        total_lines = len(lines)

        # Determine range
        s_line = max(1, start_line) if start_line is not None else 1
        e_line = min(total_lines, end_line) if end_line is not None else total_lines
        range_key = f"{s_line}:{e_line}"

        # Slice content
        selected_lines = lines[s_line - 1:e_line]
        slice_text = "".join(selected_lines)
        slice_tokens = self.count_tokens(slice_text)

        # Check Cache
        cached = self.file_hash_cache.get(path)
        if cached is not None and cached.sha256 == curr_sha256:
            # Check if this exact range was already read
            if range_key in cached.line_ranges_read:
                # CACHE HIT!
                saved = slice_tokens
                self.telemetry.cache_hits += 1
                self.telemetry.tokens_saved_by_cache += saved
                short_hash = curr_sha256[:10]
                self._log_event("cache_hit", {
                    "file": path,
                    "range": range_key,
                    "sha256": short_hash,
                    "tokens_saved": saved
                })
                return (
                    f"[CACHE HIT — saved ~{saved} tokens] "
                    f"(File '{path}' lines {s_line}-{e_line} content unchanged since last read "
                    f"at SHA-256 {short_hash}..)"
                )

        # Cache Miss or File Modified: Record in Cache
        if cached is None or cached.sha256 != curr_sha256:
            cached = FileCacheRecord(
                sha256=curr_sha256,
                mtime=curr_mtime,
                size=curr_size,
                line_count=total_lines,
                estimated_tokens=self.count_tokens(content),
                line_ranges_read={}
            )
            self.file_hash_cache[path] = cached

        cached.line_ranges_read[range_key] = curr_sha256

        # Format output with 1-based line numbers
        numbered_output = []
        for idx, line in enumerate(selected_lines, start=s_line):
            numbered_output.append(f"{idx:4d} | {line.rstrip()}")

        header = f"--- {path} (Lines {s_line}-{e_line} of {total_lines}, SHA-256: {curr_sha256[:10]}..) ---\n"
        return header + "\n".join(numbered_output)

    def tool_write_file(self, path: str, content: str) -> str:
        """
        Write file content to disk.
        SENSITIVE: Protected by human confirmation gate.
        """
        file_path = self._resolve_safe_path(path)

        # Gate check
        action_payload = {
            "type": "write_file",
            "path": path,
            "bytes": len(content.encode("utf-8")),
            "content_preview": content[:300] + ("..." if len(content) > 300 else "")
        }

        approved = self.approval_handler("write_file", action_payload)
        self.telemetry.action_audit_log.append({
            "action": "write_file",
            "path": path,
            "approved": approved,
            "timestamp": time.time()
        })

        if not approved:
            return (
                f"[ACTION DENIED BY USER] The operation 'write_file' on '{path}' was rejected "
                f"by the human operator. Do not proceed with this file write."
            )

        # Proceed with writing
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding="utf-8")

        # Invalidate/update cache
        raw = file_path.read_bytes()
        new_sha = self._compute_sha256(raw)
        self.file_hash_cache[path] = FileCacheRecord(
            sha256=new_sha,
            mtime=file_path.stat().st_mtime,
            size=len(raw),
            line_count=len(content.splitlines()),
            estimated_tokens=self.count_tokens(content),
            line_ranges_read={}
        )

        return f"Successfully wrote {len(raw)} bytes to '{path}' (SHA-256: {new_sha[:10]}..)."

    def tool_run_shell(self, command: str, timeout_seconds: int = 30) -> str:
        """
        Run shell command in workspace.
        SENSITIVE: Protected by human confirmation gate.
        """
        action_payload = {
            "type": "run_shell",
            "command": command,
            "timeout_seconds": timeout_seconds
        }

        approved = self.approval_handler("run_shell", action_payload)
        self.telemetry.action_audit_log.append({
            "action": "run_shell",
            "command": command,
            "approved": approved,
            "timestamp": time.time()
        })

        if not approved:
            return (
                f"[ACTION DENIED BY USER] The shell execution '{command}' was rejected "
                f"by the human operator. Do not execute this command."
            )

        try:
            proc = subprocess.run(
                command,
                shell=True,
                cwd=str(self.workspace_root),
                capture_output=True,
                text=True,
                timeout=timeout_seconds
            )
            output = (proc.stdout or "") + (proc.stderr or "")
            truncated = output[:2000] + ("\n... [output truncated for token efficiency]" if len(output) > 2000 else "")
            return f"Exit Code {proc.returncode}\n{truncated}"
        except subprocess.TimeoutExpired:
            return f"Error: Command timed out after {timeout_seconds} seconds."
        except Exception as e:
            return f"Error executing shell command: {str(e)}"

    def dispatch_tool(self, name: str, arguments: Dict[str, Any]) -> str:
        """Execute a tool by name."""
        if name == "list_files":
            return self.tool_list_files(
                directory=arguments.get("directory", "."),
                max_depth=arguments.get("max_depth", 3)
            )
        elif name == "search_code":
            return self.tool_search_code(
                query=arguments.get("query", ""),
                file_pattern=arguments.get("file_pattern", "*"),
                max_results=arguments.get("max_results", 30)
            )
        elif name == "read_file":
            return self.tool_read_file(
                path=arguments.get("path", ""),
                start_line=arguments.get("start_line"),
                end_line=arguments.get("end_line")
            )
        elif name == "write_file":
            return self.tool_write_file(
                path=arguments.get("path", ""),
                content=arguments.get("content", "")
            )
        elif name == "run_shell":
            return self.tool_run_shell(
                command=arguments.get("command", ""),
                timeout_seconds=arguments.get("timeout_seconds", 30)
            )
        else:
            return f"Error: Unknown tool '{name}'."

    # ----------------------------------------------------
    # BIFROST GATEWAY CALL & FAILOVER EXECUTION
    # ----------------------------------------------------

    def call_bifrost_with_failover(self, messages: List[Dict[str, Any]]) -> Tuple[Any, str]:
        """
        Call LLM through Bifrost Gateway with automatic failover across models.
        Enforces pre-call budget checks, handles rate limits/outages, and records telemetry.
        """
        candidate_models = self.get_candidate_models()
        last_error = None

        for idx, model in enumerate(candidate_models):
            # Pre-call budget estimation
            self.check_pre_call_budget(messages, model)

            try:
                self.telemetry.active_model = model
                response = self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    tools=LEANCODE_TOOLS,
                    tool_choice="auto",
                    temperature=0.2,
                )

                # Record usage telemetry
                if hasattr(response, "usage") and response.usage:
                    p_toks = response.usage.prompt_tokens or 0
                    c_toks = response.usage.completion_tokens or 0
                    self.telemetry.tokens_prompt += p_toks
                    self.telemetry.tokens_completion += c_toks
                    self.telemetry.tokens_total += (p_toks + c_toks)

                    pricing = self.get_pricing_for_model(model)
                    cost = ((p_toks / 1000.0) * pricing["prompt"]) + ((c_toks / 1000.0) * pricing["completion"])
                    self.telemetry.total_spend_usd += cost
                else:
                    # Estimate if provider/gateway didn't return usage
                    p_toks = self.estimate_messages_tokens(messages)
                    c_toks = 150
                    self.telemetry.tokens_prompt += p_toks
                    self.telemetry.tokens_completion += c_toks
                    self.telemetry.tokens_total += (p_toks + c_toks)
                    pricing = self.get_pricing_for_model(model)
                    cost = ((p_toks / 1000.0) * pricing["prompt"]) + ((c_toks / 1000.0) * pricing["completion"])
                    self.telemetry.total_spend_usd += cost

                return response, model

            except (RateLimitError, APIConnectionError, InternalServerError, APIError) as e:
                # Check for Bifrost HTTP 402 payment required or budget exhausted
                status_code = getattr(e, "status_code", None)
                err_body = str(e).lower()
                if status_code == 402 or "budget" in err_body or "quota" in err_body:
                    self.telemetry.status = "BUDGET_HALTED"
                    raise BifrostPaymentRequiredError(
                        f"[BIFROST VIRTUAL KEY BUDGET EXHAUSTED] Gateway returned code 402 / Quota Limit: {str(e)}"
                    )

                # Failover notification
                last_error = e
                has_next = (idx + 1 < len(candidate_models))
                next_model = candidate_models[idx + 1] if has_next else None

                failover_record = {
                    "failed_model": model,
                    "error": str(e),
                    "next_model": next_model,
                    "timestamp": time.time()
                }
                self.telemetry.failover_events.append(failover_record)
                self._log_event("failover", failover_record)

                if has_next:
                    print(
                        f"\n[FAILOVER NOTICE] Provider outage or rate limit on '{model}' ({type(e).__name__}). "
                        f"Failing over to '{next_model}' via Bifrost Gateway...\n",
                        file=sys.stderr
                    )
                    continue
                else:
                    break

            except Exception as e:
                # Any other unexpected exception
                last_error = e
                break

        # If all candidate models failed
        self.telemetry.status = "FAILED"
        raise LeanCodeError(f"All candidate models in chain failed. Last error: {str(last_error)}")

    # ----------------------------------------------------
    # TASK EXECUTION LOOP
    # ----------------------------------------------------

    def run_task(self, user_prompt: str, max_turns: int = 15) -> Dict[str, Any]:
        """
        Execute an end-to-end coding task with token minimization and human gates.
        """
        self.telemetry.status = "RUNNING"
        self._log_event("task_start", {"prompt": user_prompt})

        system_prompt = (
            "You are LeanCode, a high-efficiency coding agent optimized for minimal token usage.\n"
            "Guidelines:\n"
            "1. NEVER dump entire files when line-range slices will do. Use read_file with start_line/end_line.\n"
            "2. Use search_code to locate functions or bug locations instead of reading files indiscriminately.\n"
            "3. If read_file returns a [CACHE HIT], use the cached knowledge and do not repeat the call.\n"
            "4. Be concise and precise. Explain changes briefly.\n"
        )

        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        turn = 0
        final_answer = ""

        try:
            while turn < max_turns:
                turn += 1
                response, active_model = self.call_bifrost_with_failover(messages)
                choice = response.choices[0]
                message = choice.message

                # Append assistant response to messages
                asst_msg_dict: Dict[str, Any] = {
                    "role": "assistant",
                    "content": message.content or ""
                }
                if message.tool_calls:
                    asst_msg_dict["tool_calls"] = [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments
                            }
                        }
                        for tc in message.tool_calls
                    ]
                messages.append(asst_msg_dict)

                # If no tool calls, task has concluded
                if not message.tool_calls:
                    final_answer = message.content or ""
                    break

                # Execute tool calls
                for tc in message.tool_calls:
                    fn_name = tc.function.name
                    try:
                        args = json.loads(tc.function.arguments) if tc.function.arguments else {}
                    except json.JSONDecodeError:
                        args = {}

                    tool_output = self.dispatch_tool(fn_name, args)

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "name": fn_name,
                        "content": tool_output
                    })

            if not final_answer and messages:
                final_answer = messages[-1].get("content", "Task ended after max turns.")

            self.telemetry.status = "COMPLETED"

        except BudgetExceededError as e:
            final_answer = f"HALTED: {str(e)}"
        except BifrostPaymentRequiredError as e:
            final_answer = f"HALTED: {str(e)}"
        except Exception as e:
            self.telemetry.status = "FAILED"
            final_answer = f"FAILED: {str(e)}"

        return {
            "status": self.telemetry.status,
            "final_answer": final_answer,
            "telemetry": self.telemetry.to_dict(),
            "turns": turn
        }

    # ----------------------------------------------------
    # APPROVAL GATE HANDLERS
    # ----------------------------------------------------

    def _cli_approval_gate(self, action_type: str, details: Dict[str, Any]) -> bool:
        """Default interactive CLI approval gate."""
        print("\n" + "=" * 60)
        print(f"[ACTION APPROVAL REQUIRED] Security Gate triggered for: {action_type}")
        print("=" * 60)
        if action_type == "write_file":
            print(f"File Path: {details.get('path')}")
            print(f"Content Size: {details.get('bytes')} bytes")
            print("Preview:\n" + details.get("content_preview", ""))
        elif action_type == "run_shell":
            print(f"Command: {details.get('command')}")
            print(f"Timeout: {details.get('timeout_seconds')}s")
        print("=" * 60)

        # Enforce prompt-injection immune confirmation
        try:
            ans = input("Approve this action? [y/N]: ").strip().lower()
            return ans in ("y", "yes")
        except (EOFError, KeyboardInterrupt):
            return False

    def _log_event(self, event_type: str, data: Dict[str, Any]):
        """Internal telemetry logger."""
        pass


# ==========================================
# CLI ENTRY POINT (POWERED BY RICH)
# ==========================================

def run_cli():
    """Rich interactive CLI for LeanCode."""
    import argparse
    from rich.console import Console
    from rich.panel import Panel
    from rich.table import Table
    from rich.prompt import Confirm

    console = Console()

    parser = argparse.ArgumentParser(description="LeanCode: Token-Optimized Coding Agent via Bifrost Gateway")
    parser.add_argument("prompt", nargs="?", default=None, help="Coding task or instruction to execute")
    parser.add_argument("--budget", type=float, default=None, help="Budget cap in USD (default 0.25)")
    parser.add_argument("--confidential", action="store_true", help="Force local confidential mode (Ollama only)")
    parser.add_argument("--model", type=str, default=None, help="Override primary model")
    args = parser.parse_args()

    # Title Banner
    console.print(Panel.fit(
        "[bold cyan]LeanCode Agent[/bold cyan] [dim]powered by[/dim] [bold yellow]Maxim AI's Bifrost Gateway[/bold yellow]\n"
        "[dim]Gateway Endpoint: http://localhost:8080/openai/v1[/dim]",
        border_style="cyan"
    ))

    # Initialize Config
    config = LeanCodeConfig()
    if args.budget is not None:
        config.user_budget_usd = args.budget
    if args.confidential:
        config.confidential_override = True
    if args.model:
        config.primary_model = args.model

    # Rich Approval Hook
    def rich_approval(action_type: str, details: Dict[str, Any]) -> bool:
        if action_type == "write_file":
            console.print(Panel(
                f"[bold red]WRITE ACTION BLOCKED[/bold red]\n"
                f"[yellow]Target File:[/yellow] {details.get('path')}\n"
                f"[yellow]Size:[/yellow] {details.get('bytes')} bytes\n\n"
                f"[dim]{details.get('content_preview')}[/dim]",
                title="[bold yellow]Human Gate Approval Required[/bold yellow]",
                border_style="yellow"
            ))
        else:
            console.print(Panel(
                f"[bold red]SHELL COMMAND BLOCKED[/bold red]\n"
                f"[yellow]Command:[/yellow] [bold white]{details.get('command')}[/bold white]\n"
                f"[yellow]Timeout:[/yellow] {details.get('timeout_seconds')}s",
                title="[bold yellow]Human Gate Approval Required[/bold yellow]",
                border_style="yellow"
            ))
        return Confirm.ask("[bold yellow]Approve this execution?[/bold yellow]", default=False)

    engine = LeanCodeEngine(config=config, approval_handler=rich_approval)

    # Display Status Badges
    is_conf = config.is_confidential()
    lock_badge = "[bold red]LOCKED: Local Ollama Only[/bold red]" if is_conf else "[bold green]Active (Cloud + Local)[/bold green]"
    models_display = ", ".join(engine.get_candidate_models())

    table = Table(show_header=False, box=None)
    table.add_row("[bold cyan]Confidential Guard:[/bold cyan]", lock_badge)
    table.add_row("[bold cyan]Model Chain:[/bold cyan]", f"[dim]{models_display}[/dim]")
    table.add_row("[bold cyan]Budget Cap:[/bold cyan]", f"[bold green]${config.user_budget_usd:.2f} USD[/bold green]")
    table.add_row("[bold cyan]Workspace Root:[/bold cyan]", f"[dim]{config.workspace_root}[/dim]")
    console.print(Panel(table, title="[bold]Session Configuration[/bold]", border_style="blue"))

    # Prompt
    prompt = args.prompt
    if not prompt:
        console.print("[bold yellow]Enter coding task:[/bold yellow]")
        prompt = input("> ").strip()
        if not prompt:
            console.print("[dim]No task provided. Exiting.[/dim]")
            return

    with console.status("[bold green]Executing task through Bifrost Gateway...[/bold green]", spinner="dots"):
        result = engine.run_task(prompt)

    # Display Telemetry Results
    telem = result["telemetry"]
    console.print("\n" + "=" * 50)
    console.print(Panel(result["final_answer"], title="[bold green]Final Answer[/bold green]", border_style="green"))

    # Telemetry Summary Table
    t_table = Table(title="LeanCode Token & Budget Telemetry", border_style="cyan")
    t_table.add_column("Metric", style="cyan")
    t_table.add_column("Value", style="bold white")

    t_table.add_row("Task Status", f"[{'green' if telem['status']=='COMPLETED' else 'red'}]{telem['status']}[/]")
    t_table.add_row("Active Model", telem["active_model"])
    t_table.add_row("Prompt Tokens", str(telem["tokens_prompt"]))
    t_table.add_row("Completion Tokens", str(telem["tokens_completion"]))
    t_table.add_row("Total Tokens Consumed", str(telem["tokens_total"]))
    t_table.add_row("Tokens Saved by SHA-256 Cache", f"[bold green]{telem['tokens_saved_by_cache']}[/bold green]")
    t_table.add_row("Cache Hits", str(telem["cache_hits"]))
    t_table.add_row("Total Spend (USD)", f"[bold yellow]${telem['total_spend_usd']:.5f}[/bold yellow] / ${telem['budget_cap_usd']:.2f}")

    console.print(t_table)


if __name__ == "__main__":
    run_cli()
