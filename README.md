# 🌟 Life OS (ADHD-Friendly Personal Operating System)

A private, distraction-free Life Operating System designed specifically for focus, low cognitive load, and turning ambitions into daily actionable momentum.

---

## 🚀 Quick Setup with Firebase & Netlify

### 1. Firebase Setup
1. Open [Firebase Console](https://console.firebase.google.com/) and select/create your project.
2. Go to **Authentication** → **Sign-in method** → Enable **Email/Password**.
3. Go to **Users** in Firebase Auth and create your personal account (or use your existing one).
4. Go to **Firestore Database** → Create Database (Start in test mode or production).
5. Copy the rules in [`firestore.rules`](./firestore.rules) and paste them into the Firestore Rules tab in Firebase console.
6. Go to **Storage** → Get Started.
7. Copy the rules in [`storage.rules`](./storage.rules) and paste them into the Storage Rules tab.

### 2. Environment Variables
Create a `.env.local` file (or set these in Netlify Environment Variables):

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 3. Deploying on Netlify
1. Connect your repository to [Netlify](https://netlify.com).
2. Netlify will automatically detect [`netlify.toml`](./netlify.toml) with build command `npm run build` and publish directory `.next`.
3. Go to **Site Settings** → **Environment Variables** on Netlify and add your `NEXT_PUBLIC_FIREBASE_*` variables from above.
4. Trigger deploy!

---

## ✨ ADHD-Friendly Features
- **Distraction-Free Single-User Lock**: Only your pre-created Firebase account can access your system.
- **Calm Obsidian Slate Aesthetic**: Zero-glare dark mode designed to minimize sensory overload and eye fatigue.
- **Dopamine-Rewarding Micro-Cues**: Soft emerald check-offs and honey-amber action indicators.
- **Full Cloud Store & Delete Sync**: Add, modify, or delete tasks, habits, projects, notes, and file attachments with instant cloud synchronization.
- **Hyperfocus Tools**: Next Action decision assistant (`Ctrl+J`), Pomodoro Focus timer, compound task breakdown, and global quick-search (`Ctrl+K`).
