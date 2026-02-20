import os


DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql://kaiwa:kaiwa@localhost:5433/kaiwa"
)
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
EMBEDDER_URL = os.environ.get("EMBEDDER_URL", "http://localhost:8000")
RESEARCH_MODEL = os.environ.get("RESEARCH_MODEL", "deepseek/deepseek-v3.2")
RESEARCH_MAX_ITERATIONS = int(os.environ.get("RESEARCH_MAX_ITERATIONS", "8"))
