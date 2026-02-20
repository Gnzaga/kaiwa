import os

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
RESEARCH_MODEL = os.environ.get("RESEARCH_MODEL", "deepseek/deepseek-v3.2")
PAGE_LOAD_TIMEOUT_MS = int(os.environ.get("PAGE_LOAD_TIMEOUT_MS", "15000"))
MAX_CONCURRENT_PAGES = int(os.environ.get("MAX_CONCURRENT_PAGES", "3"))
MAX_CONTENT_LENGTH = 15000
