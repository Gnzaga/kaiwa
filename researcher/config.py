import os


DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://kaiwa:kaiwa@localhost:5433/kaiwa"
)
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
EMBEDDER_URL = os.environ.get("EMBEDDER_URL", "http://localhost:8000")
RESEARCH_MODEL = os.environ.get("RESEARCH_MODEL", "deepseek/deepseek-v3.2")
RESEARCH_MAX_ITERATIONS = int(os.environ.get("RESEARCH_MAX_ITERATIONS", "8"))

# Web search settings
SEARXNG_URL = os.environ.get("SEARXNG_URL", "http://kaiwa-searxng")
WEBREADER_URL = os.environ.get("WEBREADER_URL", "http://kaiwa-webreader")
WEB_SEARCH_ENABLED = os.environ.get("WEB_SEARCH_ENABLED", "true").lower() == "true"
WEB_SEARCH_MAX_RESULTS = int(os.environ.get("WEB_SEARCH_MAX_RESULTS", "10"))
WEB_READ_MAX_PAGES = int(os.environ.get("WEB_READ_MAX_PAGES", "5"))
