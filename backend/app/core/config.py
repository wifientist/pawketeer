from pydantic_settings import BaseSettings
from typing import List
import json
import os

class Settings(BaseSettings):
    # App settings
    app_name: str = "WiFi FoFum Analyzer"
    app_version: str = "0.1.0"
    debug: bool = True
    
    # API settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_reload: bool = True
    
    # Database settings
    database_url: str = "postgresql://wifif_user:wifi_password@localhost:5432/wifi_analyzer"
    
    # CORS settings
    cors_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # File upload settings
    max_file_size: int = 104857600  # 100MB in bytes
    allowed_extensions: List[str] = [".pcap", ".pcapng", ".cap"]
    upload_directory: str = "uploads"  # This is the new setting you need
    
    class Config:
        env_file = ".env"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Parse CORS_ORIGINS if it's a JSON string
        if isinstance(self.cors_origins, str):
            try:
                self.cors_origins = json.loads(self.cors_origins)
            except json.JSONDecodeError:
                # Fallback to comma-separated values
                self.cors_origins = [item.strip() for item in self.cors_origins.split(',')]

settings = Settings()

if settings.debug:
    print(f"🔧 Configuration loaded:")
    print(f"   Database URL: {settings.database_url}")
    print(f"   Upload Directory: {settings.upload_directory}")
    print(f"   CORS Origins: {settings.cors_origins}")
    print(f"   Max File Size: {settings.max_file_size / (1024*1024):.1f}MB")
