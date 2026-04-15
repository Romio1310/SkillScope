# 🎯 SkillScope
### AI-Powered Resume & Skill Gap Analyzer

SkillScope was built to solve a problem every student and job-seeker faces: **"What am I actually missing?"** 

Instead of just guessing, SkillScope uses AI to scan your resume against 13+ industry-standard roles (or your own custom ones), calculates an ATS compatibility score, and gives you a literal roadmap of what to learn next.

---

## ✨ What's inside?

- **Smart Resume Scanning**: Upload any PDF. We don't just look for keywords; we analyze the context of your projects and experience.
- **Priority Roadmaps**: We classify your missing skills into High, Medium, and Low priority so you know exactly where to start studying.
- **Team Workspaces**: Built for hiring managers or study groups. Share resumes, set custom "hiring thresholds," and see who ranks at the top of the leaderboard.
- **Aesthetic Dashboard**: A clean, dark-mode UI with a 3D particle background and interactive charts. No more boring enterprise layouts.

## 🛠️ The Tech Stack

I chose these tools because they’re modern, fast, and great for learning full-stack development:

*   **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python) — Super fast and handles JSON perfectly.
*   **Database**: [MongoDB](https://www.mongodb.com/) — Flexible storage for resumes and analysis results.
*   **Frontend**: [React](https://react.dev/) + [Tailwind CSS](https://tailwindcss.com/) — For a responsive, "premium" feel.
*   **Animations**: [Framer Motion](https://www.framer.com/motion/) + Canvas for those smooth transitions and 3D effects.

---

## 🚀 Getting Started

To run this locally, you'll need **Node.js**, **Python 3.11+**, and **MongoDB** running in the background.

### 1. The Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Setup your config
cp .env.example .env
# Edit .env with your MongoDB URL and a random JWT_SECRET string

# Fire it up
uvicorn server:app --reload
```

### 2. The Frontend
```bash
cd frontend
npm install

# Setup your config
cp .env.example .env
# Make sure REACT_APP_BACKEND_URL is pointing to your backend (default: http://127.0.0.1:8000)

npm start
```

---

## 🔒 A Note on Security
*   **Authentication**: We use JWT (JSON Web Tokens) stored in secure, `httpOnly` cookies. This is much safer than standard local storage.
*   **Passwords**: Everything is hashed with `bcrypt`. 
*   **Rate Limiting**: If someone tries to guess a password 5 times, we lock the account for 15 minutes. Simple but effective.

## 🤝 Contributing
Found a bug? Want to add a new Job Role? Open a PR! I'm always looking to make this tool more helpful for the community.

---
Built by [Romio1310](https://github.com/Romio1310)
