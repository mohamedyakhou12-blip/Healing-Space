# 🌿 فضاء الشفاء - Healing Space

## Educational Platform for Dr. Nessrine

### Quick Deploy Guide

---

## 📋 Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"**
3. Name it: `healing-space` (or your preferred name)
4. Enable **Google Analytics** (optional)
5. Click **Create Project**

### Enable Services:
- **Firestore Database** → Create database → Start in **production mode** → Choose closest location
- **Authentication** → Get started → Enable **Email/Password** sign-in
- **Storage** → Get started → Start in **production mode**

---

## 📋 Step 2: Get Firebase Configuration

1. In Firebase Console → **Project Settings** (⚙️ gear icon)
2. Scroll to **"Your apps"** → Click **Web** (`</>`) to add a web app
3. Copy the `firebaseConfig` values
4. Also copy the **Project ID**

---

## 📋 Step 3: Get Service Account Key

1. In Firebase Console → **Project Settings** → **Service Accounts** tab
2. Click **"Generate new private key"**
3. Download the JSON file
4. **Base64 encode it:**
   ```bash
   # On Mac/Linux:
   base64 -i path/to/service-account-key.json | pbcopy

   # On Linux:
   base64 -w 0 path/to/service-account-key.json | xclip -selection clipboard
   ```

---

## 📋 Step 4: Push to GitHub

```bash
# Create a new GitHub repository at https://github.com/new
# Name it: healing-space

cd /home/z/my-project
git remote add origin https://github.com/YOUR_USERNAME/healing-space.git
git branch -M main
git push -u origin main
```

---

## 📋 Step 5: Deploy to Vercel

1. Go to [Vercel](https://vercel.com/) → Sign in with GitHub
2. Click **"Add New"** → **"Project"**
3. Import your `healing-space` repository
4. Configure **Environment Variables:**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Your Firebase API Key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | your-project.firebaseapp.com |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Your Project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | your-project.appspot.com |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Your Sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Your App ID |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Base64 encoded service account JSON |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL |

5. Click **Deploy**

---

## 📋 Step 6: Configure Firestore Rules

In Firebase Console → Firestore → **Rules** tab:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Authenticated users can read content
    match /courses/{courseId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /articles/{articleId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /podcasts/{podcastId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /videos/{videoId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /pdfResources/{pdfId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /liveSessions/{sessionId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /courseChapters/{chapterId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /courseLessons/{lessonId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Subscriptions & Payments
    match /subscriptions/{subId} {
      allow read, write: if request.auth != null;
    }
    match /payments/{paymentId} {
      allow read, write: if request.auth != null;
    }

    // Reviews & Notifications
    match /reviews/{reviewId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /notifications/{notifId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Settings & Sliders
    match /siteSettings/{settingId} {
      allow read, write: if request.auth != null;
    }
    match /sliders/{sliderId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 📋 Step 7: Configure Storage Rules

In Firebase Console → Storage → **Rules** tab:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.size < 10 * 1024 * 1024;
    }
  }
}
```

---

## 🔧 Local Development

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Firebase credentials

# Run development server
bun run dev

# Run linting
bun run lint
```

---

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main SPA entry point
│   ├── api/
│   │   ├── auth/             # Login, Register, Profile
│   │   ├── admin/            # Stats, Members, Settings
│   │   ├── courses/          # Course CRUD
│   │   ├── articles/         # Article CRUD
│   │   ├── podcasts/         # Podcast CRUD
│   │   ├── videos/           # Video CRUD
│   │   ├── pdfs/             # PDF CRUD
│   │   ├── live/             # Live Session CRUD
│   │   ├── payments/         # Payment processing
│   │   ├── subscriptions/    # Subscription management
│   │   ├── reviews/          # Reviews system
│   │   ├── notifications/    # Notifications
│   │   ├── prices/           # Price management
│   │   └── upload/           # File upload
│   └── layout.tsx            # Root layout
├── components/
│   ├── pages/                # Page components (Home, Admin, etc.)
│   ├── layout/               # Header, Sidebar, Footer
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── db.ts                 # Firebase Firestore data access layer
│   ├── firebase.ts           # Firebase client SDK
│   ├── firebase-admin.ts     # Firebase Admin SDK
│   ├── store.ts              # Zustand state management
│   └── i18n.ts               # Translations (ar/fr/en)
└── middleware.ts              # Route protection
```

---

## 🌐 Features

- **3 Languages**: Arabic, French, English
- **6 Content Types**: Courses, Articles, Podcasts, Videos, PDFs, Live Sessions
- **Per-product Pricing**: Each content item can have individual pricing
- **7 Subscription Types**: Full, Courses, Articles, Podcasts, Videos, PDFs, Live
- **CCP Payment**: Algerian payment with receipt upload
- **Admin Dashboard**: Full management with gate code (052307)
- **Dark/Light Theme**: With next-themes
- **Responsive Design**: Mobile-first with Tailwind CSS
