from pydantic_settings import BaseSettings
from typing import List
import json
import os

class Settings(BaseSettings):
    # App settings
    app_name: str = "Wi-Fi Packet Analyzer"
    app_version: str = "0.1.0"
    debug: bool = False
    
    # API settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_reload: bool = True
    
    # Database settings
    database_url: str = "postgresql://wifi_user:wifi_password@localhost:5432/wifi_analyzer"

    # Redis settings
    redis_url: str = "redis://localhost:6379"
    redis_password: str = ""
    
    # CORS settings
    cors_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # File upload settings
    max_file_size: int = 104857600  # 100MB in bytes
    allowed_extensions: List[str] = [".pcap", ".pcapng", ".cap"]
    upload_directory: str = "uploads"  # This is the new setting you need

    # Auth settings
    secret_key: str = ""
    access_token_expire_hours: int = 24
    session_expire_hours: int = 48
    otp_expire_minutes: int = 10
    pending_user_expire_days: int = 7
    
    # Rate limiting settings
    otp_rate_limit_count: int = 5
    otp_rate_limit_window_minutes: int = 60
    max_otp_attempts: int = 3
    
    # Email settings (Mailgun)
    mailgun_api_key: str = ""
    mailgun_domain: str = ""
    mailgun_base_url: str = "https://api.mailgun.net/v3"
    mailgun_http_signing_key: str = ""
    email_from_name: str = "Wi-Fi Analyzer"
    
    # Frontend settings
    frontend_url: str = "http://localhost:3000"
    
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

    @property
    def redis_url_with_password(self) -> str:
        """Get Redis URL with password if provided"""
        if self.redis_password:
            # Parse the URL and add password
            if "://" in self.redis_url:
                protocol, rest = self.redis_url.split("://", 1)
                return f"{protocol}://:{self.redis_password}@{rest}"
            return self.redis_url
        return self.redis_url

settings = Settings()

if settings.debug:
    print(f"🔧 Configuration loaded:")
    print(f"   App: {settings.app_name} v{settings.app_version}")
    print(f"   Database URL: {settings.database_url}")
    print(f"   Redis URL: {settings.redis_url}")
    print(f"   Upload Directory: {settings.upload_directory}")
    print(f"   CORS Origins: {settings.cors_origins}")
    print(f"   Max File Size: {settings.max_file_size / (1024*1024):.1f}MB")
    print(f"   Frontend URL: {settings.frontend_url}")
    print(f"   OTP Expire: {settings.otp_expire_minutes} minutes")
    print(f"   Pending User Expire: {settings.pending_user_expire_days} days")
    print(f"   Rate Limit: {settings.otp_rate_limit_count} OTPs per {settings.otp_rate_limit_window_minutes} minutes")