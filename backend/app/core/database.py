from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from .config import settings
import os

# Create engine with PostgreSQL-specific settings
engine = create_engine(
    settings.database_url,
    echo=False, #settings.debug,  # Show SQL queries in debug mode
    pool_pre_ping=True,   # Verify connections before use
    pool_recycle=3600,    # Recycle connections after 1 hour
)

# Create session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """Create all database tables"""
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
    except Exception as e:
        print(f"❌ Error creating database tables: {e}")
        print("Make sure PostgreSQL is running and the database exists")
        raise

def drop_tables():
    """Drop all database tables (useful for development)"""
    try:
        Base.metadata.drop_all(bind=engine)
        print("✅ Database tables dropped successfully")
    except Exception as e:
        print(f"❌ Error dropping database tables: {e}")
        raise

def test_connection():
    """Test database connection"""
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT version()"))
            version = result.fetchone()[0]
            print(f"✅ Connected to PostgreSQL: {version}")
            return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False

def create_database_if_not_exists():
    """Create database if it doesn't exist (utility function)"""
    from urllib.parse import urlparse
    import psycopg2
    from psycopg2 import sql
    
    # Parse database URL
    parsed_url = urlparse(settings.database_url)
    db_name = parsed_url.path[1:]  # Remove leading '/'
    
    # Create connection to postgres database (default)
    temp_db_url = settings.database_url.replace(f"/{db_name}", "/postgres")
    
    try:
        # Connect to PostgreSQL server
        conn = psycopg2.connect(temp_db_url)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Check if database exists
        cursor.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
        exists = cursor.fetchone()
        
        if not exists:
            # Create database
            cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(db_name)))
            print(f"✅ Created database: {db_name}")
        else:
            print(f"✅ Database already exists: {db_name}")
            
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Error creating database: {e}")
        return False
