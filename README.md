# 🎯 SkillScope — AI-Powered Resume & Skill Gap Analyzer

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.11-blue?logo=python&logoColor=white" />
  <img src="https://img.shields.io/badge/FastAPI-0.110-green?logo=fastapi&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/MongoDB-7.0-47A248?logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.x-06B6D4?logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" />
</p>

> SkillScope is a full-stack AI-powered application that analyzes resumes against target job roles, identifies skill gaps, generates personalized learning roadmaps, and provides ATS-optimized scoring — all through a beautiful, modern dashboard.

---

## Features

### 📄 Resume Analysis
- Upload PDF resumes and get an **ATS Score** (0–100) instantly
- Detailed **Score Breakdown** across 4 key dimensions: Skill Match, Keywords, Resume Quality, Projects
- Visual radar chart for **Skills by Category**

### AI-Powered Insights
- **Skill Gap Analysis** with High / Medium / Low priority classification
- **Personalized Learning Roadmap** with resources and time estimates
- **AI Resume Suggestions** to improve your resume for specific roles

### Team Workspace
- Create teams and invite members
- Share analyses to team workspaces
- Set ATS score thresholds for candidate screening
- View team leaderboards and statistics

### Secure Authentication
- JWT-based authentication with HTTP-only cookies
- **Strong password policy** (min 8 chars, uppercase, lowercase, number, special character)
- **Name validation** (letters only — no numbers or special symbols)
- **Forgot Password** flow with 6-digit OTP verification (email-ready)
- Rate limiting with 15-minute lockout after 5 failed login attempts

### Dashboard & Analytics
- Total analyses, average score, highest score, latest score statistics
- Resume comparison mode (compare up to 5 resumes side-by-side)
- **PDF Export** of full analysis reports
- Custom job role creator

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.11, FastAPI, Motor (async MongoDB) |
| **Frontend** | React 18, TailwindCSS, Framer Motion, Recharts |
| **Database** | MongoDB |
| **Auth** | JWT (access + refresh tokens), bcrypt |
| **Build Tool** | Craco (Create React App + custom config) |

---

## Project Structure

```
SkillScope/
├── backend/
│   ├── server.py           # FastAPI application (all routes, models, logic)
│   ├── requirements.txt    # Python dependencies
│   └── .env.example        # Environment variable template
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.js
│   │   │   ├── RegisterPage.js
│   │   │   ├── ForgotPasswordPage.js
│   │   │   └── DashboardPage.js
│   │   ├── contexts/
│   │   │   └── AuthContext.js
│   │   └── components/
│   │       └── Scene3D.js
│   ├── public/
│   ├── package.json
│   └── .env.example        # Frontend environment variable template
├── backend_test.py         # Full API test suite (96 tests)
└── README.md
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Python](https://python.org/) 3.11+
- [MongoDB](https://www.mongodb.com/try/download/community) running locally on port `27017`

---

### 1. Clone the Repository

```bash
git clone https://github.com/Romio1310/SkillScope.git
cd SkillScope
```

---

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python3.11 -m venv venv
source venv/bin/activate       # macOS/Linux
# venv\Scripts\activate        # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Open .env and set your values (MongoDB URL, JWT Secret, etc.)

# Start the server
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

The backend API will be available at `http://127.0.0.1:8000`

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Open .env and set REACT_APP_BACKEND_URL=http://127.0.0.1:8000

# Start the development server
npm start
```

The frontend will be available at `http://127.0.0.1:3000`

---

### 4. Run Tests (Optional)

With both servers running:

```bash
# From project root
python backend_test.py
```

Expected: **96/96 tests passed** 

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Example |
|---|---|---|
| `MONGO_URL` | MongoDB connection string | `mongodb://127.0.0.1:27017` |
| `DB_NAME` | Database name | `skillgap` |
| `JWT_SECRET` | Secret for signing JWT tokens (min 32 chars) | `your_super_secret_key_here` |
| `EMERGENT_LLM_KEY` | LLM API key for AI suggestions | `sk-...` |

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|---|---|---|
| `REACT_APP_BACKEND_URL` | Backend base URL | `http://127.0.0.1:8000` |

> ⚠️ **Never commit `.env` files to version control.** Use `.env.example` as a template only.

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and receive JWT cookies |
| `POST` | `/api/auth/logout` | Logout and clear cookies |
| `GET` | `/api/auth/me` | Get current authenticated user |
| `POST` | `/api/auth/forgot-password` | Request OTP for password reset |
| `POST` | `/api/auth/verify-otp` | Verify the OTP code |
| `POST` | `/api/auth/reset-password` | Reset password with OTP |

### Resume Analysis
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/analyze` | Upload and analyze a resume PDF |
| `GET` | `/api/analyses` | Get all analyses for the current user |
| `GET` | `/api/analyses/{id}` | Get a specific analysis |
| `DELETE` | `/api/analyses/{id}` | Delete an analysis |
| `POST` | `/api/analyses/{id}/suggestions` | Generate AI improvement suggestions |
| `GET` | `/api/analyses/{id}/export` | Export analysis as PDF |
| `POST` | `/api/compare` | Compare multiple analyses |

### Job Roles
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/job-roles` | List all available job roles |
| `POST` | `/api/job-roles/custom` | Create a custom job role |
| `DELETE` | `/api/job-roles/custom/{id}` | Delete a custom job role |

### Teams
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/teams` | Create a team |
| `GET` | `/api/teams` | List user's teams |
| `GET` | `/api/teams/{id}` | Get team details |
| `DELETE` | `/api/teams/{id}` | Delete a team |
| `POST` | `/api/teams/{id}/invite` | Invite a member |
| `POST` | `/api/teams/{id}/candidates` | Add a candidate |
| `POST` | `/api/teams/{id}/share` | Share an analysis to the team |
| `GET` | `/api/teams/{id}/stats` | Get team statistics |
| `GET` | `/api/teams/{id}/leaderboard` | Get team leaderboard |

---

## Password Policy

All passwords must meet the following requirements:

- ✅ Minimum **8 characters**
- ✅ At least **1 uppercase letter** (A–Z)
- ✅ At least **1 lowercase letter** (a–z)
- ✅ At least **1 number** (0–9)
- ✅ At least **1 special character** (`!@#$%^&*` etc.)

---

## Forgot Password (OTP)

> **Note:** In local development, OTP codes are printed directly to the **backend terminal** (no external SMTP required). To enable real email delivery, configure SMTP settings in `backend/.env`.

---

## Development Notes

- The `backend/emergentintegrations/` directory contains a **mock stub** for the original proprietary LLM integration. It can be replaced with any LLM provider (OpenAI, Gemini, etc.)
- Resume text extraction is done using `PyPDF2` — ensure resumes are text-based PDFs (not scanned images)
- MongoDB must be running before starting the backend

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

---

<p align="center">Built with ❤️ by <a href="https://github.com/Romio1310">Romio1310</a></p>
