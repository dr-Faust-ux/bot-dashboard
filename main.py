from fastapi import FastAPI, Request, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.security import HTTPBasic, HTTPBasicCredentials
import secrets
import os
import json
from datetime import datetime
import re
from collections import defaultdict
from typing import List, Dict, Any
import glob
from pathlib import Path

app = FastAPI(title="Bot Dashboard")

# Настройки аутентификации
SECRET_KEY = "your-secret-key-here"  # поменяй в продакшене
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin"
security = HTTPBasic()

# Определяем базовые пути
BASE_DIR = Path(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"
LOGS_DIR = Path("/home/kaizer/Рабочий стол/Проекты/ковалев/fl-bots-master/logs")

# Создаем директории если их нет
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(TEMPLATES_DIR, exist_ok=True)
os.makedirs(LOGS_DIR, exist_ok=True)

# Монтируем статические файлы
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Создаем экземпляр Jinja2Templates
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

# Функция проверки аутентификации
def authenticate_user(credentials: HTTPBasicCredentials = Depends(security)):
    correct_username = secrets.compare_digest(credentials.username, ADMIN_USERNAME)
    correct_password = secrets.compare_digest(credentials.password, ADMIN_PASSWORD)
    
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверные учетные данные",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

# Добавляем фильтр для определения класса уровня логирования
def level_class(level: str) -> str:
    classes = {
        'INFO': 'bg-success',
        'WARNING': 'bg-warning',
        'ERROR': 'bg-danger',
        'CRITICAL': 'bg-dark',
        'DEBUG': 'bg-secondary'
    }
    return classes.get(level, 'bg-secondary')

templates.env.filters["level_class"] = level_class

# ВСЯ СУЩЕСТВУЮЩАЯ ЛОГИКА ПАРСИНГА ЛОГОВ ОСТАЕТСЯ БЕЗ ИЗМЕНЕНИЙ
def parse_log_line(line: str) -> Dict[str, Any]:
    """Парсит строку лога и возвращает структурированные данные"""
    pattern = r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - ([^-]+) - ([^-]+) - (.+)'
    match = re.match(pattern, line)
    if match:
        timestamp, name, level, message = match.groups()
        data = {
            "timestamp": datetime.strptime(timestamp.strip(), "%Y-%m-%d %H:%M:%S"),
            "name": name.strip(),
            "level": level.strip(),
            "raw": line,
            "metadata": None
        }
        
        # Проверяем наличие метаданных
        metadata_match = re.search(r'(.*?)\s*\[metadata:(.*)\]$', message)
        if metadata_match:
            message_part, metadata_str = metadata_match.groups()
            try:
                print(f"Debug: Found metadata in message. Metadata string: {metadata_str}")  # Отладка
                data["message"] = message_part.strip()
                data["metadata"] = json.loads(metadata_str)
                print(f"Debug: Parsed metadata: {data['metadata']}")  # Отладка
            except json.JSONDecodeError as e:
                print(f"Error parsing metadata: {e}, metadata_str: {metadata_str}")
                data["message"] = message
        else:
            data["message"] = message.strip()
        
        return data
    return None

class LogEntry:
    def __init__(self, timestamp: datetime, level: str, name: str, message: str, metadata: dict = None, raw: str = None):
        self.timestamp = timestamp
        self.level = level
        self.name = name
        self.message = message
        self.metadata = metadata
        self.raw = raw
        self.file = None  # Будет установлено позже

    def to_dict(self) -> dict:
        """Конвертирует объект в словарь для JSON-сериализации"""
        return {
            "timestamp": self.timestamp.isoformat(),
            "level": self.level,
            "name": self.name,
            "message": self.message,
            "metadata": self.metadata,
            "file": self.file,
            "raw": self.raw
        }

def get_log_files() -> List[str]:
    """Возвращает список файлов логов"""
    return glob.glob(os.path.join(LOGS_DIR, "*.log"))

def get_log_data(files: List[str] = None) -> List[LogEntry]:
    """Читает и парсит файлы логов"""
    log_data = []
    if files is None:
        files = get_log_files()
    
    for file_path in files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    parsed = parse_log_line(line)
                    if parsed:
                        log_data.append(LogEntry(
                            timestamp=parsed['timestamp'],
                            level=parsed['level'],
                            name=parsed['name'],
                            message=parsed['message'],
                            metadata=parsed['metadata'],
                            raw=parsed['raw']
                        ))
                        log_data[-1].file = os.path.basename(file_path)
        except Exception as e:
            print(f"Error reading log file {file_path}: {e}")
    
    return sorted(log_data, key=lambda x: x.timestamp, reverse=True)

def calculate_statistics(log_data: List[LogEntry]) -> Dict[str, Any]:
    """Генерирует статистику по логам"""
    stats = {
        "by_level": defaultdict(int),
        "by_hour": defaultdict(int),
        "by_file": defaultdict(int),
        "by_name": defaultdict(int),
    }
    
    for entry in log_data:
        stats["by_level"][entry.level] += 1
        stats["by_hour"][entry.timestamp.strftime("%Y-%m-%d %H:00")] += 1
        stats["by_file"][entry.file] += 1
        stats["by_name"][entry.name] += 1
    
    return {k: dict(v) for k, v in stats.items()}

# НОВЫЕ ROUTES
@app.get("/")
async def dashboard(request: Request, username: str = Depends(authenticate_user)):
    """Главная панель управления"""
    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "username": username
        }
    )

@app.get("/logs")
async def logs_page(request: Request, username: str = Depends(authenticate_user)):
    """Страница просмотра логов"""
    logs = get_log_data()
    statistics = calculate_statistics(logs)
    files = get_log_files()
    
    return templates.TemplateResponse(
        "logs.html",
        {
            "request": request,
            "logs": logs,
            "statistics": statistics,
            "files": files,
            "username": username
        }
    )

# СУЩЕСТВУЮЩИЕ API ENDPOINTS (с аутентификацией)
@app.get("/api/logs")
async def get_logs(
    request: Request,
    level: str = None,
    file: str = None,
    metadata_key: str = None,
    metadata_value: str = None,
    start_date: str = None,
    end_date: str = None,
    username: str = Depends(authenticate_user)
):
    """API для получения отфильтрованных логов"""
    logs = get_log_data()
    
    # Применяем фильтры
    if level:
        logs = [log for log in logs if log.level == level]
    if file:
        logs = [log for log in logs if log.file == file]
    if metadata_key and metadata_value:
        logs = [
            log for log in logs 
            if log.metadata and 
            str(log.metadata.get(metadata_key)) == metadata_value
        ]
    if start_date:
        start = datetime.fromisoformat(start_date)
        logs = [log for log in logs if log.timestamp >= start]
    if end_date:
        end = datetime.fromisoformat(end_date)
        logs = [log for log in logs if log.timestamp <= end]
    
    return {
        "logs": [log.to_dict() for log in logs],
        "statistics": calculate_statistics(logs)
    }

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting server on port {port}...")
    print(f"Logs directory: {LOGS_DIR}")
    print(f"Login: {ADMIN_USERNAME} / {ADMIN_PASSWORD}")
    uvicorn.run(app, host="0.0.0.0", port=port)
