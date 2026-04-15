from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, UploadFile, File, Form, Depends
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from emergentintegrations.llm.chat import LlmChat, UserMessage
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import os
import logging
import bcrypt
import jwt
import secrets
import pdfplumber
import io
import re
import uuid
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── JWT CONFIG ───
JWT_ALGORITHM = "HS256"

def get_jwt_secret():
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=120), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def set_auth_cookies(response, access_token, refresh_token):
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=7200, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

# ─── AUTH VALIDATIONS ───
import re
import string

def validate_secure_password(password: str):
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", password):
        raise ValueError("Password must contain at least one number")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
        raise ValueError("Password must contain at least one special character")

def validate_name(name: str):
    if not re.match(r"^[A-Za-z\s]+$", name.strip()):
        raise ValueError("Name should not contain numbers or special symbols")

# ─── AUTH MODELS ───
class RegisterInput(BaseModel):
    email: str
    password: str
    name: str

class LoginInput(BaseModel):
    email: str
    password: str

class ForgotPasswordInput(BaseModel):
    email: str

class VerifyOtpInput(BaseModel):
    email: str
    otp: str

class ResetPasswordInput(BaseModel):
    email: str
    otp: str
    new_password: str

# ─── AUTH ENDPOINTS ───
@api_router.post("/auth/register")
async def register(input_data: RegisterInput):
    email = input_data.email.strip().lower()
    
    try:
        validate_name(input_data.name)
        validate_secure_password(input_data.password)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_doc = {
        "email": email,
        "password_hash": hash_password(input_data.password),
        "name": input_data.name.strip(),
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    resp = JSONResponse(content={"id": user_id, "email": email, "name": user_doc["name"], "role": "user"})
    set_auth_cookies(resp, access, refresh)
    return resp

@api_router.post("/auth/forgot-password")
async def forgot_password(input_data: ForgotPasswordInput):
    email = input_data.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user:
        # Prevent user enumeration, just return 200
        return {"message": "If that email exists, an OTP has been dispatched to it."}

    import secrets
    otp = ''.join(secrets.choice(string.digits) for i in range(6))
    
    await db.password_resets.update_one(
        {"email": email},
        {
            "$set": {
                "otp": hash_password(otp),
                "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
            }
        },
        upsert=True
    )
    
    # Mock sending email
    logger.info("=" * 40)
    logger.info(f"MOCK EMAIL SENT TO: {email}")
    logger.info(f"SUBJECT: Your Password Reset OTP")
    logger.info(f"OTP CODE: {otp}")
    logger.info("=" * 40)
    
    return {"message": "If that email exists, an OTP has been dispatched to it."}

@api_router.post("/auth/verify-otp")
async def verify_otp(input_data: VerifyOtpInput):
    email = input_data.email.strip().lower()
    record = await db.password_resets.find_one({"email": email})
    
    if not record or not verify_password(input_data.otp, record.get("otp", "")):
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    if datetime.now(timezone.utc) > datetime.fromisoformat(record["expires_at"]):
        raise HTTPException(status_code=400, detail="OTP has expired")
        
    return {"message": "OTP is valid"}

@api_router.post("/auth/reset-password")
async def reset_password(input_data: ResetPasswordInput):
    email = input_data.email.strip().lower()
    record = await db.password_resets.find_one({"email": email})
    
    if not record or not verify_password(input_data.otp, record.get("otp", "")):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
    if datetime.now(timezone.utc) > datetime.fromisoformat(record["expires_at"]):
        raise HTTPException(status_code=400, detail="OTP has expired")
        
    try:
        validate_secure_password(input_data.new_password)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
        
    await db.users.update_one(
        {"email": email},
        {"$set": {"password_hash": hash_password(input_data.new_password)}}
    )
    
    await db.password_resets.delete_one({"email": email})
    return {"message": "Password successfully reset"}

@api_router.post("/auth/login")
async def login(input_data: LoginInput, request: Request):
    email = input_data.email.strip().lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        lockout_until = attempt.get("locked_until")
        if lockout_until and datetime.now(timezone.utc) < datetime.fromisoformat(lockout_until):
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(input_data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}},
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_one({"identifier": identifier})
    user_id = str(user["_id"])
    access = create_access_token(user_id, email)
    refresh = create_refresh_token(user_id)
    resp = JSONResponse(content={"id": user_id, "email": email, "name": user.get("name", ""), "role": user.get("role", "user")})
    set_auth_cookies(resp, access, refresh)
    return resp

@api_router.post("/auth/logout")
async def logout():
    resp = JSONResponse(content={"message": "Logged out"})
    resp.delete_cookie("access_token", path="/")
    resp.delete_cookie("refresh_token", path="/")
    return resp

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/refresh")
async def refresh_token(request: Request):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user_id = str(user["_id"])
        new_access = create_access_token(user_id, user["email"])
        resp = JSONResponse(content={"message": "Token refreshed"})
        resp.set_cookie(key="access_token", value=new_access, httponly=True, secure=False, samesite="lax", max_age=7200, path="/")
        return resp
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ─── SKILL INTELLIGENCE ENGINE ───
JOB_ROLES = {
    "software_engineer": {
        "title": "Software Engineer",
        "required_skills": {
            "core": ["python", "javascript", "java", "c++", "typescript", "go", "rust", "c#"],
            "frameworks": ["react", "angular", "vue", "django", "flask", "spring boot", "express", "next.js", "node.js", "fastapi"],
            "databases": ["sql", "mysql", "postgresql", "mongodb", "redis", "elasticsearch"],
            "devops": ["docker", "kubernetes", "aws", "azure", "gcp", "ci/cd", "jenkins", "terraform", "github actions"],
            "concepts": ["data structures", "algorithms", "system design", "microservices", "rest api", "graphql", "oop", "design patterns", "agile", "scrum", "tdd", "unit testing"],
            "tools": ["git", "linux", "jira", "confluence", "vs code"]
        },
        "keywords": ["software", "engineer", "developer", "full stack", "backend", "frontend", "api", "web", "application", "scalable", "performance", "architecture", "code review", "debugging", "deployment"],
        "project_keywords": ["built", "developed", "implemented", "designed", "deployed", "optimized", "scaled", "automated", "integrated", "migrated", "refactored"]
    },
    "full_stack_developer": {
        "title": "Full Stack Developer",
        "required_skills": {
            "frontend": ["html", "css", "javascript", "typescript", "react", "next.js", "vue", "angular", "tailwind css", "sass", "webpack", "responsive design"],
            "backend": ["node.js", "express", "python", "django", "flask", "fastapi", "java", "spring boot", "rest api", "graphql"],
            "databases": ["sql", "postgresql", "mysql", "mongodb", "redis", "firebase", "prisma", "orm"],
            "devops": ["docker", "aws", "vercel", "netlify", "ci/cd", "git", "github actions", "linux"],
            "concepts": ["authentication", "authorization", "caching", "websockets", "server-side rendering", "api design", "testing", "agile", "oop", "mvc"]
        },
        "keywords": ["full stack", "fullstack", "developer", "web developer", "frontend", "backend", "react", "node", "api", "database", "deployment", "responsive", "application"],
        "project_keywords": ["built", "developed", "designed", "deployed", "implemented", "integrated", "created", "launched", "optimized", "maintained", "architected"]
    },
    "backend_developer": {
        "title": "Backend Developer",
        "required_skills": {
            "languages": ["python", "java", "go", "node.js", "c#", "rust", "typescript", "php", "ruby"],
            "frameworks": ["django", "flask", "fastapi", "spring boot", "express", "gin", "nest.js", "laravel", "rails"],
            "databases": ["postgresql", "mysql", "mongodb", "redis", "elasticsearch", "cassandra", "sql", "orm", "database design"],
            "infrastructure": ["docker", "kubernetes", "aws", "gcp", "azure", "terraform", "ci/cd", "nginx", "linux", "microservices"],
            "concepts": ["rest api", "graphql", "grpc", "message queues", "rabbitmq", "kafka", "caching", "authentication", "security", "system design", "scalability", "load balancing"]
        },
        "keywords": ["backend", "server", "api", "microservices", "database", "scalable", "distributed", "cloud", "infrastructure", "performance", "architecture", "security"],
        "project_keywords": ["built", "developed", "designed", "implemented", "deployed", "optimized", "scaled", "architected", "migrated", "automated", "integrated"]
    },
    "frontend_developer": {
        "title": "Frontend Developer",
        "required_skills": {
            "core": ["html", "css", "javascript", "typescript", "responsive design", "accessibility", "cross-browser compatibility"],
            "frameworks": ["react", "next.js", "vue", "nuxt", "angular", "svelte", "remix"],
            "styling": ["tailwind css", "sass", "styled-components", "css modules", "material ui", "bootstrap", "css grid", "flexbox", "animations"],
            "tools": ["webpack", "vite", "babel", "eslint", "prettier", "storybook", "figma", "git", "npm", "yarn"],
            "concepts": ["state management", "redux", "context api", "react hooks", "component design", "performance optimization", "seo", "pwa", "testing", "jest", "cypress"]
        },
        "keywords": ["frontend", "front-end", "ui", "user interface", "web", "react", "design", "responsive", "interactive", "pixel perfect", "component", "user experience"],
        "project_keywords": ["built", "designed", "developed", "implemented", "created", "optimized", "improved", "launched", "redesigned", "animated"]
    },
    "data_analyst": {
        "title": "Data Analyst",
        "required_skills": {
            "core": ["sql", "excel", "python", "r", "statistics", "data visualization", "data cleaning", "data modeling"],
            "tools": ["tableau", "power bi", "google analytics", "looker", "metabase", "jupyter", "google sheets", "dbt"],
            "languages": ["python", "sql", "r", "sas"],
            "libraries": ["pandas", "numpy", "matplotlib", "seaborn", "plotly", "scipy"],
            "concepts": ["a/b testing", "hypothesis testing", "regression analysis", "kpi tracking", "dashboarding", "etl", "data pipeline", "business intelligence", "reporting", "data storytelling"]
        },
        "keywords": ["data", "analyst", "analysis", "analytics", "insights", "reporting", "dashboard", "visualization", "metrics", "kpi", "business intelligence", "sql", "excel"],
        "project_keywords": ["analyzed", "discovered", "reported", "visualized", "tracked", "improved", "identified", "automated", "built dashboard", "reduced", "increased"]
    },
    "data_scientist": {
        "title": "Data Scientist",
        "required_skills": {
            "core": ["python", "r", "sql", "statistics", "mathematics", "linear algebra", "calculus", "probability"],
            "ml": ["machine learning", "deep learning", "neural networks", "nlp", "computer vision", "reinforcement learning", "feature engineering", "model evaluation"],
            "frameworks": ["tensorflow", "pytorch", "scikit-learn", "keras", "pandas", "numpy", "scipy", "matplotlib", "seaborn", "plotly", "spark", "hadoop"],
            "tools": ["jupyter", "anaconda", "git", "docker", "aws sagemaker", "google colab", "databricks", "mlflow"],
            "concepts": ["regression", "classification", "clustering", "dimensionality reduction", "a/b testing", "hypothesis testing", "time series", "recommendation systems", "data pipeline", "etl"]
        },
        "keywords": ["data", "science", "scientist", "analytics", "analysis", "machine learning", "ai", "artificial intelligence", "model", "prediction", "insight", "visualization", "research", "experiment"],
        "project_keywords": ["analyzed", "modeled", "predicted", "trained", "evaluated", "visualized", "discovered", "improved accuracy", "reduced error", "built pipeline", "processed data"]
    },
    "ml_engineer": {
        "title": "Machine Learning Engineer",
        "required_skills": {
            "core": ["python", "mathematics", "statistics", "linear algebra", "machine learning", "deep learning"],
            "frameworks": ["tensorflow", "pytorch", "scikit-learn", "keras", "hugging face", "onnx", "tensorrt"],
            "mlops": ["mlflow", "kubeflow", "airflow", "docker", "kubernetes", "aws sagemaker", "gcp vertex ai", "model serving", "feature store"],
            "data": ["sql", "spark", "pandas", "numpy", "data pipeline", "etl", "data preprocessing", "feature engineering"],
            "concepts": ["model deployment", "model monitoring", "a/b testing", "distributed training", "hyperparameter tuning", "transfer learning", "nlp", "computer vision", "recommendation systems"]
        },
        "keywords": ["machine learning", "ml", "ai", "deep learning", "model", "training", "deployment", "inference", "pipeline", "production", "scalable", "optimization"],
        "project_keywords": ["trained", "deployed", "optimized", "built", "improved", "reduced latency", "increased accuracy", "automated", "scaled", "implemented", "designed pipeline"]
    },
    "devops_engineer": {
        "title": "DevOps Engineer",
        "required_skills": {
            "core": ["linux", "bash", "python", "docker", "kubernetes", "terraform", "ansible", "ci/cd"],
            "cloud": ["aws", "azure", "gcp", "ec2", "s3", "lambda", "cloudformation", "iam"],
            "tools": ["jenkins", "github actions", "gitlab ci", "circleci", "prometheus", "grafana", "elk stack", "datadog", "pagerduty"],
            "concepts": ["infrastructure as code", "containerization", "orchestration", "monitoring", "logging", "alerting", "security", "networking", "load balancing", "auto scaling"],
            "databases": ["mysql", "postgresql", "mongodb", "redis", "elasticsearch"]
        },
        "keywords": ["devops", "infrastructure", "cloud", "deployment", "automation", "pipeline", "monitoring", "reliability", "sre", "containers", "orchestration", "security"],
        "project_keywords": ["automated", "deployed", "built", "configured", "implemented", "migrated", "optimized", "reduced downtime", "improved", "managed", "scaled"]
    },
    "cloud_architect": {
        "title": "Cloud Architect",
        "required_skills": {
            "platforms": ["aws", "azure", "gcp", "multi-cloud", "hybrid cloud"],
            "services": ["ec2", "s3", "lambda", "rds", "dynamodb", "cloudfront", "vpc", "iam", "eks", "ecs", "api gateway"],
            "architecture": ["microservices", "serverless", "event-driven", "distributed systems", "high availability", "disaster recovery", "cost optimization"],
            "tools": ["terraform", "cloudformation", "pulumi", "docker", "kubernetes", "helm", "istio"],
            "concepts": ["security", "compliance", "networking", "load balancing", "caching", "cdn", "database design", "message queues", "monitoring"]
        },
        "keywords": ["cloud", "architect", "architecture", "aws", "azure", "infrastructure", "scalable", "distributed", "migration", "design", "solution", "enterprise"],
        "project_keywords": ["architected", "designed", "migrated", "deployed", "optimized", "reduced costs", "improved", "built", "led", "implemented"]
    },
    "mobile_developer": {
        "title": "Mobile Developer",
        "required_skills": {
            "platforms": ["ios", "android", "react native", "flutter", "swift", "kotlin", "dart"],
            "ios": ["swift", "swiftui", "uikit", "xcode", "cocoapods", "core data", "combine"],
            "android": ["kotlin", "java", "jetpack compose", "android studio", "gradle", "room", "retrofit"],
            "cross_platform": ["react native", "flutter", "expo", "capacitor", "ionic"],
            "concepts": ["mobile ui/ux", "push notifications", "offline storage", "app store optimization", "ci/cd", "testing", "performance", "accessibility", "rest api", "graphql"]
        },
        "keywords": ["mobile", "ios", "android", "app", "developer", "react native", "flutter", "swift", "kotlin", "cross-platform", "ui", "responsive"],
        "project_keywords": ["built", "developed", "published", "launched", "designed", "optimized", "implemented", "integrated", "improved", "released"]
    },
    "ui_ux_designer": {
        "title": "UI/UX Designer",
        "required_skills": {
            "design": ["figma", "sketch", "adobe xd", "photoshop", "illustrator", "prototyping", "wireframing", "mockups"],
            "research": ["user research", "usability testing", "user interviews", "persona", "journey mapping", "information architecture", "card sorting"],
            "ui": ["design systems", "typography", "color theory", "layout", "responsive design", "accessibility", "wcag", "material design", "ios guidelines"],
            "tools": ["figma", "miro", "notion", "jira", "invision", "principle", "framer", "storybook"],
            "concepts": ["user-centered design", "design thinking", "interaction design", "visual design", "heuristic evaluation", "a/b testing", "conversion optimization"]
        },
        "keywords": ["design", "designer", "ui", "ux", "user experience", "user interface", "figma", "prototype", "wireframe", "research", "usability", "accessibility"],
        "project_keywords": ["designed", "prototyped", "researched", "tested", "improved", "created", "redesigned", "led", "conducted", "increased conversion", "reduced friction"]
    },
    "cybersecurity_analyst": {
        "title": "Cybersecurity Analyst",
        "required_skills": {
            "core": ["network security", "vulnerability assessment", "penetration testing", "incident response", "threat analysis", "siem", "firewall"],
            "tools": ["wireshark", "nmap", "metasploit", "burp suite", "splunk", "nessus", "snort", "kali linux"],
            "concepts": ["encryption", "authentication", "authorization", "owasp", "zero trust", "compliance", "risk assessment", "forensics", "malware analysis"],
            "frameworks": ["nist", "iso 27001", "cis", "pci dss", "hipaa", "gdpr", "soc 2"],
            "skills": ["python", "bash", "linux", "networking", "tcp/ip", "dns", "vpn", "ids/ips", "endpoint security"]
        },
        "keywords": ["security", "cybersecurity", "cyber", "threat", "vulnerability", "compliance", "risk", "incident", "forensics", "penetration", "audit", "protection"],
        "project_keywords": ["identified", "mitigated", "implemented", "conducted", "assessed", "secured", "monitored", "responded", "reduced risk", "improved", "automated"]
    },
    "product_manager": {
        "title": "Product Manager",
        "required_skills": {
            "core": ["product strategy", "roadmap planning", "user research", "market analysis", "competitive analysis", "stakeholder management", "prioritization", "product lifecycle"],
            "methodologies": ["agile", "scrum", "kanban", "lean", "design thinking", "okrs", "kpis", "sprint planning"],
            "tools": ["jira", "confluence", "figma", "miro", "amplitude", "mixpanel", "google analytics", "tableau", "sql", "slack", "notion"],
            "skills": ["communication", "leadership", "data-driven", "problem solving", "cross-functional", "negotiation", "presentation", "storytelling", "customer empathy"],
            "concepts": ["mvp", "product-market fit", "user stories", "acceptance criteria", "a/b testing", "funnel analysis", "customer journey", "persona", "wireframing", "prototyping"]
        },
        "keywords": ["product", "manager", "management", "strategy", "roadmap", "stakeholder", "requirements", "feature", "launch", "growth", "metrics", "user experience", "customer"],
        "project_keywords": ["launched", "managed", "led", "drove", "increased", "improved", "defined", "prioritized", "coordinated", "delivered", "shipped"]
    }
}

SKILL_SYNONYMS = {
    "js": "javascript", "ts": "typescript", "py": "python", "ml": "machine learning",
    "dl": "deep learning", "nn": "neural networks", "cv": "computer vision",
    "nlp": "natural language processing", "k8s": "kubernetes", "tf": "tensorflow",
    "aws": "amazon web services", "gcp": "google cloud platform", "ci/cd": "continuous integration",
    "oop": "object oriented programming", "dsa": "data structures", "dbms": "databases",
    "pm": "product manager", "ux": "user experience", "ui": "user interface",
    "qa": "quality assurance", "tdd": "test driven development", "bdd": "behavior driven development",
    "api": "rest api", "nosql": "mongodb", "postgres": "postgresql", "mongo": "mongodb",
    "react.js": "react", "reactjs": "react", "node": "node.js", "nodejs": "node.js",
    "vue.js": "vue", "angular.js": "angular", "express.js": "express",
    "spring": "spring boot", "flask": "flask", "django": "django",
    "sklearn": "scikit-learn", "sk-learn": "scikit-learn"
}

def extract_text_from_pdf(file_bytes: bytes) -> str:
    text = ""
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text

def normalize_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^\w\s\+\#\.\-/]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_skills_from_text(text: str, job_role_key: str) -> dict:
    normalized = normalize_text(text)
    words_set = set(normalized.split())
    role = JOB_ROLES[job_role_key]
    all_required = {}
    for category, skills in role["required_skills"].items():
        for skill in skills:
            all_required[skill] = category
    matched = {}
    missing = {}
    for skill, category in all_required.items():
        skill_lower = skill.lower()
        found = False
        if skill_lower in normalized:
            found = True
        else:
            for synonym, canonical in SKILL_SYNONYMS.items():
                if canonical == skill_lower and synonym in normalized:
                    found = True
                    break
                if synonym == skill_lower and canonical in normalized:
                    found = True
                    break
            if not found:
                for word in skill_lower.split():
                    if len(word) > 2 and word in words_set:
                        found = True
                        break
        if found:
            matched[skill] = category
        else:
            missing[skill] = category
    return {"matched": matched, "missing": missing}

def calculate_ats_score(text: str, job_role_key: str, skill_result: dict) -> dict:
    normalized = normalize_text(text)
    role = JOB_ROLES[job_role_key]
    total_skills = len(skill_result["matched"]) + len(skill_result["missing"])
    skill_match_pct = (len(skill_result["matched"]) / total_skills * 100) if total_skills > 0 else 0
    keyword_count = sum(1 for kw in role["keywords"] if kw.lower() in normalized)
    keyword_pct = (keyword_count / len(role["keywords"]) * 100) if role["keywords"] else 0
    word_count = len(normalized.split())
    has_email = bool(re.search(r'[\w.-]+@[\w.-]+\.\w+', normalized))
    has_phone = bool(re.search(r'[\+]?[\d\s\-\(\)]{7,15}', normalized))
    has_sections = sum(1 for s in ["experience", "education", "skills", "projects", "summary", "objective", "work history", "certifications"]
                       if s in normalized)
    section_score = min(has_sections / 4.0, 1.0) * 100
    contact_score = (50 if has_email else 0) + (50 if has_phone else 0)
    length_score = min(word_count / 400, 1.0) * 100
    quality_pct = (section_score * 0.4 + contact_score * 0.3 + length_score * 0.3)
    project_count = sum(1 for kw in role["project_keywords"] if kw.lower() in normalized)
    project_pct = min((project_count / max(len(role["project_keywords"]) * 0.5, 1)) * 100, 100)
    total_score = round(
        skill_match_pct * 0.50 +
        keyword_pct * 0.20 +
        quality_pct * 0.15 +
        project_pct * 0.15
    )
    total_score = max(0, min(100, total_score))
    return {
        "total_score": total_score,
        "skill_match": round(skill_match_pct),
        "keyword_match": round(keyword_pct),
        "resume_quality": round(quality_pct),
        "project_relevance": round(project_pct),
        "details": {
            "matched_skills_count": len(skill_result["matched"]),
            "total_skills": total_skills,
            "keywords_found": keyword_count,
            "total_keywords": len(role["keywords"]),
            "word_count": word_count,
            "has_email": has_email,
            "has_phone": has_phone,
            "sections_found": has_sections
        }
    }

def classify_skill_priority(skill: str, category: str) -> str:
    high_priority_categories = ["core", "ml"]
    if category in high_priority_categories:
        return "high"
    medium_priority_categories = ["frameworks", "methodologies", "concepts"]
    if category in medium_priority_categories:
        return "medium"
    return "low"

def generate_gap_analysis(skill_result: dict) -> list:
    gaps = []
    for skill, category in skill_result["missing"].items():
        priority = classify_skill_priority(skill, category)
        gaps.append({
            "skill": skill,
            "category": category,
            "priority": priority
        })
    gaps.sort(key=lambda x: {"high": 0, "medium": 1, "low": 2}[x["priority"]])
    return gaps

LEARNING_RESOURCES = {
    "python": {"resource": "Python.org Official Tutorial", "url": "https://docs.python.org/3/tutorial/", "duration": "2-4 weeks"},
    "javascript": {"resource": "MDN JavaScript Guide", "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide", "duration": "2-4 weeks"},
    "java": {"resource": "Oracle Java Tutorials", "url": "https://docs.oracle.com/javase/tutorial/", "duration": "4-6 weeks"},
    "react": {"resource": "React Official Docs", "url": "https://react.dev/learn", "duration": "3-4 weeks"},
    "docker": {"resource": "Docker Getting Started", "url": "https://docs.docker.com/get-started/", "duration": "1-2 weeks"},
    "kubernetes": {"resource": "Kubernetes Basics", "url": "https://kubernetes.io/docs/tutorials/", "duration": "3-4 weeks"},
    "aws": {"resource": "AWS Free Tier + Tutorials", "url": "https://aws.amazon.com/getting-started/", "duration": "4-8 weeks"},
    "machine learning": {"resource": "Andrew Ng ML Course", "url": "https://www.coursera.org/learn/machine-learning", "duration": "8-12 weeks"},
    "deep learning": {"resource": "Deep Learning Specialization", "url": "https://www.coursera.org/specializations/deep-learning", "duration": "12-16 weeks"},
    "tensorflow": {"resource": "TensorFlow Tutorials", "url": "https://www.tensorflow.org/tutorials", "duration": "4-6 weeks"},
    "pytorch": {"resource": "PyTorch Tutorials", "url": "https://pytorch.org/tutorials/", "duration": "4-6 weeks"},
    "sql": {"resource": "SQLBolt Interactive Lessons", "url": "https://sqlbolt.com/", "duration": "1-2 weeks"},
    "mongodb": {"resource": "MongoDB University", "url": "https://university.mongodb.com/", "duration": "2-3 weeks"},
    "git": {"resource": "Git Handbook", "url": "https://guides.github.com/introduction/git-handbook/", "duration": "1 week"},
    "system design": {"resource": "System Design Primer", "url": "https://github.com/donnemartin/system-design-primer", "duration": "6-8 weeks"},
    "data structures": {"resource": "NeetCode Roadmap", "url": "https://neetcode.io/roadmap", "duration": "8-12 weeks"},
    "agile": {"resource": "Agile Manifesto + Scrum Guide", "url": "https://scrumguides.org/", "duration": "1-2 weeks"},
    "product strategy": {"resource": "Inspired by Marty Cagan", "url": "https://www.svpg.com/inspired-how-to-create-products-customers-love/", "duration": "2-3 weeks"},
    "user research": {"resource": "UX Research Methods", "url": "https://www.nngroup.com/articles/which-ux-research-methods/", "duration": "2-4 weeks"},
    "figma": {"resource": "Figma Learn", "url": "https://help.figma.com/", "duration": "1-2 weeks"},
    "statistics": {"resource": "Khan Academy Statistics", "url": "https://www.khanacademy.org/math/statistics-probability", "duration": "4-6 weeks"},
    "nlp": {"resource": "Hugging Face NLP Course", "url": "https://huggingface.co/course", "duration": "6-8 weeks"},
    "scikit-learn": {"resource": "Scikit-learn Tutorials", "url": "https://scikit-learn.org/stable/tutorial/", "duration": "2-3 weeks"},
    "pandas": {"resource": "Pandas Documentation", "url": "https://pandas.pydata.org/docs/getting_started/", "duration": "1-2 weeks"},
    "numpy": {"resource": "NumPy Quickstart", "url": "https://numpy.org/doc/stable/user/quickstart.html", "duration": "1 week"},
    "ci/cd": {"resource": "GitHub Actions Docs", "url": "https://docs.github.com/en/actions", "duration": "1-2 weeks"},
    "rest api": {"resource": "RESTful API Design", "url": "https://restfulapi.net/", "duration": "1 week"},
    "microservices": {"resource": "Microservices.io Patterns", "url": "https://microservices.io/patterns/", "duration": "4-6 weeks"},
    "design patterns": {"resource": "Refactoring Guru", "url": "https://refactoring.guru/design-patterns", "duration": "4-6 weeks"},
}

def generate_roadmap(gaps: list, job_role_key: str) -> list:
    roadmap = []
    phase_num = 1
    phases = {"high": [], "medium": [], "low": []}
    for gap in gaps:
        phases[gap["priority"]].append(gap)
    for priority in ["high", "medium", "low"]:
        if not phases[priority]:
            continue
        phase_label = {
            "high": "Foundation & Core Skills",
            "medium": "Framework & Methodology Skills",
            "low": "Tools & Nice-to-Have Skills"
        }[priority]
        items = []
        for gap in phases[priority]:
            skill = gap["skill"]
            resource_info = LEARNING_RESOURCES.get(skill, {
                "resource": f"Search for '{skill}' courses on Coursera/Udemy",
                "url": f"https://www.google.com/search?q=learn+{skill.replace(' ', '+')}",
                "duration": "2-4 weeks"
            })
            items.append({
                "skill": skill,
                "category": gap["category"],
                "resource": resource_info["resource"],
                "url": resource_info["url"],
                "estimated_duration": resource_info["duration"]
            })
        roadmap.append({
            "phase": phase_num,
            "title": phase_label,
            "priority": priority,
            "items": items
        })
        phase_num += 1
    return roadmap

# ─── API: JOB ROLES ───
@api_router.get("/job-roles")
async def get_job_roles(request: Request):
    roles = []
    for key, role in JOB_ROLES.items():
        skill_count = sum(len(skills) for skills in role["required_skills"].values())
        roles.append({
            "key": key,
            "title": role["title"],
            "categories": list(role["required_skills"].keys()),
            "total_skills": skill_count,
            "is_custom": False
        })
    # Include user's custom roles if authenticated
    try:
        user = await get_current_user(request)
        custom_roles = await db.custom_roles.find({"user_id": user["_id"]}, {"_id": 0}).to_list(50)
        for cr in custom_roles:
            skill_count = sum(len(skills) for skills in cr.get("required_skills", {}).values())
            roles.append({
                "key": cr["key"],
                "title": cr["title"],
                "categories": list(cr.get("required_skills", {}).keys()),
                "total_skills": skill_count,
                "is_custom": True,
                "id": cr.get("id")
            })
    except Exception:
        pass
    return roles

# ─── API: RESUME UPLOAD & ANALYSIS ───
@api_router.post("/analyze")
async def analyze_resume(request: Request, file: UploadFile = File(...), job_role: str = Form(...)):
    user = await get_current_user(request)
    # Check built-in roles first, then custom
    role_data = None
    if job_role in JOB_ROLES:
        role_data = JOB_ROLES[job_role]
    else:
        custom = await db.custom_roles.find_one({"key": job_role, "user_id": user["_id"]}, {"_id": 0})
        if custom:
            role_data = custom
    if not role_data:
        raise HTTPException(status_code=400, detail=f"Invalid job role.")
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")
    file_bytes = await file.read()
    if len(file_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")
    text = extract_text_from_pdf(file_bytes)
    if not text or len(text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Could not extract sufficient text from PDF. Ensure it is not image-only.")
    # Use role_data directly for custom roles
    temp_key = job_role
    if job_role not in JOB_ROLES:
        JOB_ROLES[temp_key] = role_data
    skill_result = extract_skills_from_text(text, temp_key)
    ats_scores = calculate_ats_score(text, temp_key, skill_result)
    gaps = generate_gap_analysis(skill_result)
    roadmap = generate_roadmap(gaps, temp_key)
    if temp_key != job_role or job_role not in ["software_engineer", "data_scientist", "product_manager"]:
        if temp_key in JOB_ROLES and temp_key not in ["software_engineer", "data_scientist", "product_manager"]:
            del JOB_ROLES[temp_key]
    analysis_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["_id"],
        "job_role": job_role,
        "job_role_title": role_data.get("title", job_role),
        "filename": file.filename,
        "ats_score": ats_scores["total_score"],
        "score_breakdown": {
            "skill_match": ats_scores["skill_match"],
            "keyword_match": ats_scores["keyword_match"],
            "resume_quality": ats_scores["resume_quality"],
            "project_relevance": ats_scores["project_relevance"]
        },
        "details": ats_scores["details"],
        "matched_skills": [{"skill": s, "category": c} for s, c in skill_result["matched"].items()],
        "missing_skills": [{"skill": s, "category": c} for s, c in skill_result["missing"].items()],
        "gaps": gaps,
        "roadmap": roadmap,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.analysis_results.insert_one({**analysis_doc, "_id": analysis_doc["id"]})
    return analysis_doc

# ─── API: ANALYSIS HISTORY ───
@api_router.get("/analyses")
async def get_analyses(request: Request):
    user = await get_current_user(request)
    results = await db.analysis_results.find(
        {"user_id": user["_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return results

@api_router.get("/analyses/{analysis_id}")
async def get_analysis(analysis_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.analysis_results.find_one(
        {"id": analysis_id, "user_id": user["_id"]},
        {"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return result

@api_router.delete("/analyses/{analysis_id}")
async def delete_analysis(analysis_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.analysis_results.delete_one({"id": analysis_id, "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {"message": "Analysis deleted"}

# ─── API: DASHBOARD STATS ───
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request):
    user = await get_current_user(request)
    analyses = await db.analysis_results.find(
        {"user_id": user["_id"]},
        {"_id": 0, "ats_score": 1, "job_role_title": 1, "created_at": 1, "score_breakdown": 1}
    ).sort("created_at", -1).to_list(100)
    total = len(analyses)
    if total == 0:
        return {"total_analyses": 0, "average_score": 0, "highest_score": 0, "latest_score": 0, "score_trend": [], "role_distribution": {}}
    scores = [a["ats_score"] for a in analyses]
    role_dist = {}
    for a in analyses:
        title = a.get("job_role_title", "Unknown")
        role_dist[title] = role_dist.get(title, 0) + 1
    return {
        "total_analyses": total,
        "average_score": round(sum(scores) / total),
        "highest_score": max(scores),
        "latest_score": scores[0] if scores else 0,
        "score_trend": [{"score": a["ats_score"], "date": a["created_at"], "role": a.get("job_role_title", "")} for a in analyses[:10]],
        "role_distribution": role_dist
    }

@api_router.get("/")
async def root():
    return {"message": "Skill Gap Analyzer API"}

# ─── AI SUGGESTIONS ENGINE ───
@api_router.post("/analyses/{analysis_id}/suggestions")
async def get_ai_suggestions(analysis_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.analysis_results.find_one({"id": analysis_id, "user_id": user["_id"]}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    cached = await db.ai_suggestions.find_one({"analysis_id": analysis_id}, {"_id": 0})
    if cached:
        return cached
    matched_skills = [s["skill"] for s in result.get("matched_skills", [])]
    missing_skills = [s["skill"] for s in result.get("missing_skills", [])]
    high_gaps = [g["skill"] for g in result.get("gaps", []) if g["priority"] == "high"]
    prompt = f"""You are an expert resume consultant and ATS optimization specialist.

Analyze this resume evaluation and provide specific, actionable improvement suggestions.

Target Role: {result.get("job_role_title", "Unknown")}
ATS Score: {result.get("ats_score", 0)}/100
Score Breakdown:
- Skill Match: {result.get("score_breakdown", {}).get("skill_match", 0)}%
- Keyword Match: {result.get("score_breakdown", {}).get("keyword_match", 0)}%
- Resume Quality: {result.get("score_breakdown", {}).get("resume_quality", 0)}%
- Project Relevance: {result.get("score_breakdown", {}).get("project_relevance", 0)}%

Matched Skills ({len(matched_skills)}): {', '.join(matched_skills[:15])}
Missing Critical Skills: {', '.join(high_gaps[:10])}
All Missing Skills ({len(missing_skills)}): {', '.join(missing_skills[:20])}

Provide your response in exactly this format (use these exact headers):

## OVERALL ASSESSMENT
(2-3 sentence summary of the resume's strengths and weaknesses for this role)

## TOP 5 QUICK WINS
1. (specific actionable change that will boost ATS score immediately)
2. (specific actionable change)
3. (specific actionable change)
4. (specific actionable change)
5. (specific actionable change)

## SKILL RECOMMENDATIONS
(For each of the top 3-5 missing critical skills, provide a specific bullet point example of how to add it to the resume - e.g., a rewritten experience bullet)

## KEYWORD OPTIMIZATION
(List 5-8 specific keywords/phrases to incorporate naturally into the resume)

## RESUME STRUCTURE TIPS
(3-4 specific formatting or structural improvements)

## SAMPLE BULLET REWRITES
(Provide 3 example "before and after" resume bullet points that incorporate missing skills)"""

    try:
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        chat = LlmChat(
            api_key=api_key,
            session_id=f"suggestions-{analysis_id}",
            system_message="You are an expert resume consultant specializing in ATS optimization. Be specific and actionable."
        )
        chat.with_model("openai", "gpt-4o")
        response = await chat.send_message(UserMessage(text=prompt))
        suggestion_doc = {
            "analysis_id": analysis_id,
            "user_id": user["_id"],
            "suggestions": response,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.ai_suggestions.insert_one({**suggestion_doc})
        suggestion_doc.pop("_id", None)
        return suggestion_doc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI suggestion error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate AI suggestions. Please try again.")

# ─── RESUME COMPARISON ───
class CompareInput(BaseModel):
    analysis_ids: List[str]

@api_router.post("/compare")
async def compare_analyses(input_data: CompareInput, request: Request):
    user = await get_current_user(request)
    if len(input_data.analysis_ids) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 analyses to compare")
    if len(input_data.analysis_ids) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 analyses can be compared")
    analyses = []
    for aid in input_data.analysis_ids:
        result = await db.analysis_results.find_one({"id": aid, "user_id": user["_id"]}, {"_id": 0})
        if not result:
            raise HTTPException(status_code=404, detail=f"Analysis {aid} not found")
        analyses.append(result)
    comparison = {
        "analyses": [],
        "best_overall": None,
        "best_skill_match": None,
        "common_matched_skills": [],
        "common_missing_skills": [],
    }
    best_score = -1
    best_skill = -1
    all_matched_sets = []
    all_missing_sets = []
    for a in analyses:
        matched_set = set(s["skill"] for s in a.get("matched_skills", []))
        missing_set = set(s["skill"] for s in a.get("missing_skills", []))
        all_matched_sets.append(matched_set)
        all_missing_sets.append(missing_set)
        entry = {
            "id": a["id"],
            "filename": a.get("filename", ""),
            "job_role_title": a.get("job_role_title", ""),
            "ats_score": a.get("ats_score", 0),
            "score_breakdown": a.get("score_breakdown", {}),
            "matched_count": len(matched_set),
            "missing_count": len(missing_set),
        }
        comparison["analyses"].append(entry)
        if a.get("ats_score", 0) > best_score:
            best_score = a["ats_score"]
            comparison["best_overall"] = a["id"]
        sm = a.get("score_breakdown", {}).get("skill_match", 0)
        if sm > best_skill:
            best_skill = sm
            comparison["best_skill_match"] = a["id"]
    if all_matched_sets:
        comparison["common_matched_skills"] = list(set.intersection(*all_matched_sets))[:20]
    if all_missing_sets:
        comparison["common_missing_skills"] = list(set.intersection(*all_missing_sets))[:20]
    return comparison

# ─── PDF EXPORT ───
@api_router.get("/analyses/{analysis_id}/export")
async def export_analysis_pdf(analysis_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.analysis_results.find_one({"id": analysis_id, "user_id": user["_id"]}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Analysis not found")
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=40, bottomMargin=40, leftMargin=50, rightMargin=50)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('CustomTitle', parent=styles['Title'], fontSize=20, spaceAfter=6, textColor=colors.HexColor('#1a1a2e'))
    heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading2'], fontSize=14, spaceAfter=8, spaceBefore=16, textColor=colors.HexColor('#16213e'))
    body_style = ParagraphStyle('CustomBody', parent=styles['Normal'], fontSize=10, spaceAfter=4, leading=14)
    small_style = ParagraphStyle('SmallText', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#555555'))
    elements = []
    elements.append(Paragraph("SkillScope - Resume Analysis Report", title_style))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(f"Generated on {datetime.now().strftime('%B %d, %Y')}", small_style))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e0e0e0')))
    elements.append(Spacer(1, 12))
    info_data = [
        ["File:", result.get("filename", "N/A")],
        ["Target Role:", result.get("job_role_title", "N/A")],
        ["ATS Score:", f"{result.get('ats_score', 0)} / 100"],
    ]
    info_table = Table(info_data, colWidths=[1.2*inch, 4.5*inch])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#333333')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 16))
    elements.append(Paragraph("Score Breakdown", heading_style))
    sb = result.get("score_breakdown", {})
    score_data = [
        ["Component", "Score", "Weight"],
        ["Skill Match", f"{sb.get('skill_match', 0)}%", "50%"],
        ["Keyword Match", f"{sb.get('keyword_match', 0)}%", "20%"],
        ["Resume Quality", f"{sb.get('resume_quality', 0)}%", "15%"],
        ["Project Relevance", f"{sb.get('project_relevance', 0)}%", "15%"],
    ]
    score_table = Table(score_data, colWidths=[2.5*inch, 1.5*inch, 1.5*inch])
    score_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a2e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
    ]))
    elements.append(score_table)
    elements.append(Spacer(1, 16))
    matched = result.get("matched_skills", [])
    if matched:
        elements.append(Paragraph(f"Matched Skills ({len(matched)})", heading_style))
        matched_text = ", ".join([s["skill"] for s in matched])
        elements.append(Paragraph(matched_text, body_style))
        elements.append(Spacer(1, 8))
    missing = result.get("missing_skills", [])
    if missing:
        elements.append(Paragraph(f"Missing Skills ({len(missing)})", heading_style))
        gaps = result.get("gaps", [])
        for priority in ["high", "medium", "low"]:
            priority_gaps = [g for g in gaps if g["priority"] == priority]
            if priority_gaps:
                label = {"high": "High Priority", "medium": "Medium Priority", "low": "Low Priority"}[priority]
                gap_text = f"<b>{label}:</b> " + ", ".join([g["skill"] for g in priority_gaps])
                elements.append(Paragraph(gap_text, body_style))
        elements.append(Spacer(1, 8))
    roadmap = result.get("roadmap", [])
    if roadmap:
        elements.append(Paragraph("Learning Roadmap", heading_style))
        for phase in roadmap:
            elements.append(Paragraph(f"<b>Phase {phase['phase']}: {phase['title']}</b>", body_style))
            for item in phase["items"]:
                elements.append(Paragraph(f"&bull; {item['skill']} - {item['resource']} ({item['estimated_duration']})", small_style))
            elements.append(Spacer(1, 6))
    doc.build(elements)
    buffer.seek(0)
    filename = f"skillscope_report_{result.get('job_role_title', 'analysis').replace(' ', '_').lower()}_{analysis_id[:8]}.pdf"
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename={filename}"})

# ─── CUSTOM JOB ROLES ───
class CustomRoleInput(BaseModel):
    title: str
    skills: Dict[str, List[str]]
    keywords: List[str] = []
    project_keywords: List[str] = []

@api_router.post("/job-roles/custom")
async def create_custom_role(input_data: CustomRoleInput, request: Request):
    user = await get_current_user(request)
    if not input_data.title.strip():
        raise HTTPException(status_code=400, detail="Role title is required")
    if not input_data.skills:
        raise HTTPException(status_code=400, detail="At least one skill category is required")
    key = re.sub(r'[^a-z0-9_]', '_', input_data.title.strip().lower().replace(' ', '_'))
    key = f"custom_{key}_{str(uuid.uuid4())[:6]}"
    existing = await db.custom_roles.find_one({"key": key, "user_id": user["_id"]})
    if existing:
        raise HTTPException(status_code=400, detail="A role with this name already exists")
    role_doc = {
        "id": str(uuid.uuid4()),
        "key": key,
        "user_id": user["_id"],
        "title": input_data.title.strip(),
        "required_skills": input_data.skills,
        "keywords": input_data.keywords if input_data.keywords else [],
        "project_keywords": input_data.project_keywords if input_data.project_keywords else ["built", "developed", "implemented", "designed", "deployed", "optimized", "led", "managed"],
        "is_custom": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.custom_roles.insert_one({**role_doc, "_id": role_doc["id"]})
    role_doc.pop("_id", None)
    return role_doc

@api_router.get("/job-roles/custom")
async def get_custom_roles(request: Request):
    user = await get_current_user(request)
    roles = await db.custom_roles.find({"user_id": user["_id"]}, {"_id": 0}).to_list(50)
    return roles

@api_router.delete("/job-roles/custom/{role_id}")
async def delete_custom_role(role_id: str, request: Request):
    user = await get_current_user(request)
    result = await db.custom_roles.delete_one({"id": role_id, "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Custom role not found")
    return {"message": "Custom role deleted"}

# ─── TEAMS / ORGANIZATION WORKSPACE ───
class CreateTeamInput(BaseModel):
    name: str
    description: str = ""

class InviteMemberInput(BaseModel):
    email: str
    role: str = "member"

class SetThresholdInput(BaseModel):
    job_role: str
    min_score: int

class AddCandidateInput(BaseModel):
    name: str
    email: str = ""
    notes: str = ""

class AssignAnalysisInput(BaseModel):
    analysis_id: str
    candidate_id: str

@api_router.post("/teams")
async def create_team(input_data: CreateTeamInput, request: Request):
    user = await get_current_user(request)
    team_doc = {
        "id": str(uuid.uuid4()),
        "name": input_data.name.strip(),
        "description": input_data.description.strip(),
        "owner_id": user["_id"],
        "members": [{"user_id": user["_id"], "email": user["email"], "name": user.get("name", ""), "role": "owner"}],
        "thresholds": {},
        "candidates": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.teams.insert_one({**team_doc, "_id": team_doc["id"]})
    team_doc.pop("_id", None)
    return team_doc

@api_router.get("/teams")
async def get_teams(request: Request):
    user = await get_current_user(request)
    teams = await db.teams.find({"members.user_id": user["_id"]}, {"_id": 0}).to_list(20)
    return teams

@api_router.get("/teams/{team_id}")
async def get_team(team_id: str, request: Request):
    user = await get_current_user(request)
    team = await db.teams.find_one({"id": team_id, "members.user_id": user["_id"]}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    # Enrich with shared analyses
    shared = await db.team_analyses.find({"team_id": team_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    team["shared_analyses"] = shared
    return team

@api_router.post("/teams/{team_id}/invite")
async def invite_member(team_id: str, input_data: InviteMemberInput, request: Request):
    user = await get_current_user(request)
    team = await db.teams.find_one({"id": team_id, "owner_id": user["_id"]}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=403, detail="Only the team owner can invite members")
    email = input_data.email.strip().lower()
    for m in team.get("members", []):
        if m["email"] == email:
            raise HTTPException(status_code=400, detail="User already in team")
    target_user = await db.users.find_one({"email": email})
    member = {
        "user_id": str(target_user["_id"]) if target_user else None,
        "email": email,
        "name": target_user.get("name", "") if target_user else "",
        "role": input_data.role if input_data.role in ["member", "admin"] else "member",
        "invited_at": datetime.now(timezone.utc).isoformat()
    }
    await db.teams.update_one({"id": team_id}, {"$push": {"members": member}})
    return {"message": f"Invited {email}", "member": member}

@api_router.delete("/teams/{team_id}/members/{member_email}")
async def remove_member(team_id: str, member_email: str, request: Request):
    user = await get_current_user(request)
    team = await db.teams.find_one({"id": team_id, "owner_id": user["_id"]}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=403, detail="Only the team owner can remove members")
    await db.teams.update_one({"id": team_id}, {"$pull": {"members": {"email": member_email.lower()}}})
    return {"message": f"Removed {member_email}"}

@api_router.post("/teams/{team_id}/thresholds")
async def set_threshold(team_id: str, input_data: SetThresholdInput, request: Request):
    user = await get_current_user(request)
    team = await db.teams.find_one({"id": team_id, "members.user_id": user["_id"]}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if not (0 <= input_data.min_score <= 100):
        raise HTTPException(status_code=400, detail="Score must be 0-100")
    await db.teams.update_one({"id": team_id}, {"$set": {f"thresholds.{input_data.job_role}": input_data.min_score}})
    return {"message": "Threshold updated", "job_role": input_data.job_role, "min_score": input_data.min_score}

@api_router.post("/teams/{team_id}/candidates")
async def add_candidate(team_id: str, input_data: AddCandidateInput, request: Request):
    user = await get_current_user(request)
    team = await db.teams.find_one({"id": team_id, "members.user_id": user["_id"]}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    candidate = {
        "id": str(uuid.uuid4()),
        "name": input_data.name.strip(),
        "email": input_data.email.strip().lower() if input_data.email else "",
        "notes": input_data.notes.strip(),
        "analysis_ids": [],
        "added_by": user["_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.teams.update_one({"id": team_id}, {"$push": {"candidates": candidate}})
    return candidate

@api_router.delete("/teams/{team_id}/candidates/{candidate_id}")
async def remove_candidate(team_id: str, candidate_id: str, request: Request):
    user = await get_current_user(request)
    team = await db.teams.find_one({"id": team_id, "members.user_id": user["_id"]}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    await db.teams.update_one({"id": team_id}, {"$pull": {"candidates": {"id": candidate_id}}})
    return {"message": "Candidate removed"}

@api_router.post("/teams/{team_id}/share-analysis")
async def share_analysis(team_id: str, input_data: AssignAnalysisInput, request: Request):
    user = await get_current_user(request)
    team = await db.teams.find_one({"id": team_id, "members.user_id": user["_id"]}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    analysis = await db.analysis_results.find_one({"id": input_data.analysis_id, "user_id": user["_id"]}, {"_id": 0})
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    shared_doc = {
        "id": str(uuid.uuid4()),
        "team_id": team_id,
        "analysis_id": analysis["id"],
        "candidate_id": input_data.candidate_id,
        "shared_by": user["_id"],
        "shared_by_name": user.get("name", user.get("email", "")),
        "filename": analysis.get("filename", ""),
        "job_role_title": analysis.get("job_role_title", ""),
        "ats_score": analysis.get("ats_score", 0),
        "score_breakdown": analysis.get("score_breakdown", {}),
        "matched_count": len(analysis.get("matched_skills", [])),
        "missing_count": len(analysis.get("missing_skills", [])),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.team_analyses.insert_one({**shared_doc, "_id": shared_doc["id"]})
    # Add analysis to candidate
    if input_data.candidate_id:
        await db.teams.update_one(
            {"id": team_id, "candidates.id": input_data.candidate_id},
            {"$addToSet": {"candidates.$.analysis_ids": analysis["id"]}}
        )
    # Check thresholds
    threshold = team.get("thresholds", {}).get(analysis.get("job_role", ""), 0)
    passes_threshold = analysis.get("ats_score", 0) >= threshold if threshold > 0 else True
    shared_doc["passes_threshold"] = passes_threshold
    shared_doc["threshold"] = threshold
    shared_doc.pop("_id", None)
    return shared_doc

@api_router.get("/teams/{team_id}/stats")
async def get_team_stats(team_id: str, request: Request):
    user = await get_current_user(request)
    team = await db.teams.find_one({"id": team_id, "members.user_id": user["_id"]}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    shared = await db.team_analyses.find({"team_id": team_id}, {"_id": 0}).to_list(500)
    total = len(shared)
    if total == 0:
        return {"total_shared": 0, "average_score": 0, "passing_count": 0, "failing_count": 0, "role_breakdown": {}, "score_distribution": []}
    scores = [s["ats_score"] for s in shared]
    thresholds = team.get("thresholds", {})
    passing = 0
    failing = 0
    role_breakdown = {}
    for s in shared:
        role = s.get("job_role_title", "Unknown")
        if role not in role_breakdown:
            role_breakdown[role] = {"count": 0, "total_score": 0, "passing": 0}
        role_breakdown[role]["count"] += 1
        role_breakdown[role]["total_score"] += s["ats_score"]
        threshold = thresholds.get(s.get("job_role_title", "").lower().replace(" ", "_"), 0)
        if threshold > 0 and s["ats_score"] >= threshold:
            passing += 1
            role_breakdown[role]["passing"] += 1
        elif threshold > 0:
            failing += 1
    for role in role_breakdown:
        role_breakdown[role]["average_score"] = round(role_breakdown[role]["total_score"] / role_breakdown[role]["count"])
    buckets = {"0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0}
    for s in scores:
        if s <= 25: buckets["0-25"] += 1
        elif s <= 50: buckets["26-50"] += 1
        elif s <= 75: buckets["51-75"] += 1
        else: buckets["76-100"] += 1
    return {
        "total_shared": total,
        "average_score": round(sum(scores) / total),
        "highest_score": max(scores),
        "lowest_score": min(scores),
        "passing_count": passing,
        "failing_count": failing,
        "member_count": len(team.get("members", [])),
        "candidate_count": len(team.get("candidates", [])),
        "role_breakdown": role_breakdown,
        "score_distribution": [{"range": k, "count": v} for k, v in buckets.items()],
        "thresholds": thresholds
    }

@api_router.delete("/teams/{team_id}")
async def delete_team(team_id: str, request: Request):
    user = await get_current_user(request)
    team = await db.teams.find_one({"id": team_id, "owner_id": user["_id"]})
    if not team:
        raise HTTPException(status_code=403, detail="Only the team owner can delete the team")
    await db.teams.delete_one({"id": team_id})
    await db.team_analyses.delete_many({"team_id": team_id})
    return {"message": "Team deleted"}

# ─── CANDIDATE RANKING LEADERBOARD ───
@api_router.get("/teams/{team_id}/leaderboard")
async def get_leaderboard(team_id: str, request: Request, role: str = None):
    user = await get_current_user(request)
    team = await db.teams.find_one({"id": team_id, "members.user_id": user["_id"]}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    shared = await db.team_analyses.find({"team_id": team_id}, {"_id": 0}).to_list(500)
    thresholds = team.get("thresholds", {})
    candidates = {c["id"]: {**c, "analyses": [], "best_score": 0, "avg_score": 0, "passes_threshold": False} for c in team.get("candidates", [])}
    # Also track unassigned
    unassigned = []
    for sa in shared:
        cid = sa.get("candidate_id")
        if role and sa.get("job_role_title", "").lower().replace(" ", "_") != role:
            continue
        entry = {
            "analysis_id": sa["analysis_id"],
            "filename": sa.get("filename", ""),
            "job_role_title": sa.get("job_role_title", ""),
            "ats_score": sa.get("ats_score", 0),
            "score_breakdown": sa.get("score_breakdown", {}),
            "shared_by": sa.get("shared_by_name", ""),
            "date": sa.get("created_at", ""),
        }
        role_key = sa.get("job_role_title", "").lower().replace(" ", "_")
        threshold = thresholds.get(role_key, 0)
        entry["threshold"] = threshold
        entry["passes"] = sa.get("ats_score", 0) >= threshold if threshold > 0 else None
        if cid and cid in candidates:
            candidates[cid]["analyses"].append(entry)
        else:
            unassigned.append(entry)
    # Compute stats per candidate
    ranked = []
    for cid, c in candidates.items():
        if not c["analyses"]:
            ranked.append({**c, "rank": 0})
            continue
        scores = [a["ats_score"] for a in c["analyses"]]
        c["best_score"] = max(scores)
        c["avg_score"] = round(sum(scores) / len(scores))
        c["total_analyses"] = len(scores)
        best_analysis = max(c["analyses"], key=lambda a: a["ats_score"])
        c["best_role"] = best_analysis.get("job_role_title", "")
        any_pass = any(a.get("passes") for a in c["analyses"] if a.get("passes") is not None)
        c["passes_threshold"] = any_pass
        ranked.append(c)
    # Sort by best score descending
    ranked.sort(key=lambda x: x.get("best_score", 0), reverse=True)
    for i, c in enumerate(ranked):
        c["rank"] = i + 1 if c.get("best_score", 0) > 0 else 0
    return {
        "leaderboard": ranked,
        "unassigned_analyses": unassigned,
        "total_candidates": len(team.get("candidates", [])),
        "total_analyses": len(shared),
        "thresholds": thresholds
    }

# ─── STARTUP ───
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.analysis_results.create_index("user_id")
    await db.teams.create_index("members.user_id")
    await db.team_analyses.create_index("team_id")
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
