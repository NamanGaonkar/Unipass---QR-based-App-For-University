# UniPass

Real-time smart attendance system using secure QR sessions.

UniPass lets a teacher generate a short-lived class QR, students scan or paste it, and attendance appears live in the teacher console and admin dashboard.

## Highlights

- Live classroom attendance with instant updates
- Subject-based session control
- QR session expiry with epoch window validation
- Duplicate protection per student, subject, teacher, and session
- Local JSON-backed backend for easy demo and development
- Student fallback flow: manual JSON paste when camera is unavailable

## Project Structure

```text
Unipass/
├── backend/         Node.js + Express API (local DB JSON)
├── dashboard/       React + Vite admin panel
├── mobile/          React Native teacher app (QR generator + live list)
├── student-mobile/  Expo student app (scan + paste + mark attendance)
├── shared/          Shared utilities
└── ASSETS/          Project screenshots for documentation
```

## Screenshots

### Teacher App

![Teacher Login](ASSETS/Teachers%20log%20in.png)

![Teacher Dashboard](ASSETS/Teachers%20Dashboard.png)

![Teacher Dashboard Live Attendance](ASSETS/Teachers%20Dashboard%202.png)

### Student App

![Student App Scan View](ASSETS/Student%20App%20Demo%20.png)

![Student App Manual JSON and Marking](ASSETS/Student%20App%20demo%202.png)

### Admin Dashboard

![Admin Dashboard](ASSETS/Admin%20DashBoard.png)

## Quick Start

### 1) Backend

```bash
cd backend
npm install
node server.js
```

Runs on: `http://localhost:5000`

### 2) Admin Dashboard

```bash
cd dashboard
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Open: `http://localhost:5173`

### 3) Teacher App (React Native)

```bash
cd mobile
npm install
npx react-native start --port 8081
```

Then run on Android emulator/device in a separate terminal if needed.

### 4) Student App (Expo)

```bash
cd student-mobile
npm install
npx expo start --port 8083 --android
```

## How Attendance Flow Works

1. Admin creates subjects in dashboard.
2. Teacher logs in and selects subject.
3. Teacher generates a live QR session.
4. Student scans QR or pastes copied JSON.
5. Student taps mark attendance.
6. Teacher sees live attendance list update in real-time.

## API Overview

- `GET /api/teacher/subjects`
- `POST /api/teacher/generate-session`
- `GET /api/teacher/attendance-summary`
- `POST /api/student/mark-attendance`
- `GET /api/admin/subjects`
- `POST /api/admin/subjects`
- `PUT /api/admin/subjects/:subjectId`
- `DELETE /api/admin/subjects/:subjectId`

See full details in `API_DOCUMENTATION.md`.

## Docs

- `START_HERE.md`
- `QUICKSTART.md`
- `PROJECT_SUMMARY.md`
- `ARCHITECTURE.md`
- `API_DOCUMENTATION.md`

## License

MIT
