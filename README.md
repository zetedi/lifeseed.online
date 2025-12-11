
<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Lifeseed

A decentralized social sharing platform where every lifetree is a blockchain of presents.

## 🚀 Fresh Start Deployment Guide

If you are setting this up from scratch or facing "configuration not found" errors, follow these steps exactly.

### 1. Create Firebase Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com).
2. Create a new project (e.g., `lifeseed-v2`).
3. Turn off Google Analytics (optional, makes setup faster).

### 2. Enable Authentication (Crucial)
1. Go to **Authentication** -> **Sign-in method**.
2. Click **Google**.
3. Toggle **Enable**.
4. **Important**: Select your email in the "Project support email" dropdown.
5. Click **Save**.

### 3. Enable Database & Storage
1. **Firestore**: Go to **Firestore Database** -> **Create database** -> Start in **Production mode** -> Select a region -> Create.
2. **Storage**: Go to **Storage** -> **Get started** -> Start in **Production mode** -> Done.

### 4. Get Configuration
1. Click the **Project Settings** (gear icon) -> **General**.
2. Scroll to "Your apps". Click the **Web icon (</>)**.
3. Register app as `lifeseed-web`.
4. Copy the `firebaseConfig` keys shown.

### 5. Environment Variables (.env)
Create a file named `.env` in the root folder and fill it with your new keys:

```env
API_KEY=AIzaSy... (Your Gemini API Key)

VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

### 6. Apply Security Rules
Manually copy the content of `firestore.rules` and `storage.rules` from this project into the **Rules** tab of your Firestore and Storage sections in the Firebase Console.

### 7. Run Locally
```bash
npm install
npm run dev
```

## 🌍 Deploying to Production

### Step 1: Set up GitHub Secrets (Critical for Oracle/AI)
For the Oracle and Firebase connection to work on the deployed site, you **must** add your keys to GitHub Secrets.

1. Go to your GitHub Repository.
2. Click **Settings** -> **Secrets and variables** -> **Actions**.
3. Click **New repository secret**.
4. Add the following secret:
   - **Name:** `API_KEY`
   - **Value:** Your Gemini API Key (`AIzaSy...`)
5. (Recommended) Add your Firebase keys as well (`VITE_FIREBASE_API_KEY`, etc.) to ensure the production build connects to the correct database.

### Step 2: Configure Firebase CLI
Since you created a new project, you must tell the Firebase CLI which project to use.

1. **List your projects** to find the new ID:
   ```bash
   npx firebase projects:list
   ```

2. **Switch to the new project**:
   ```bash
   npx firebase use <YOUR_NEW_PROJECT_ID>
   ```
   *(Example: `npx firebase use lifeseed-v2`)*

3. **Deploy**:
   ```bash
   npm run build
   npx firebase deploy
   ```

## Troubleshooting

### Error: Service account ... does not exist (HTTP 404)
This means the Service Account credential stored in your GitHub Secrets has been deleted from Google Cloud or is invalid.

**Fix:**
1. Run `firebase init hosting:github` in your terminal.
2. Overwrite the existing workflow files if asked.
3. This command will create a **new** Service Account key.
4. **If it fails to update GitHub Secrets automatically:**
   - It will print the new key to your terminal (starts with `{"type": "service_account"...}`).
   - Go to your GitHub Repository -> Settings -> Secrets and variables -> Actions.
   - Update `FIREBASE_SERVICE_ACCOUNT_LIFESEED_75DFE` with the new key content.

### Error 400: redirect_uri_mismatch or Access Blocked
This means your current website URL (e.g., `localhost:3000` or `https://xyz.idx.dev`) is not allowed by Firebase.
1. Copy your current browser domain (e.g., `xyz.idx.dev`).
2. Go to **Firebase Console** -> **Authentication** -> **Settings**.
3. Click **Authorized domains** -> **Add domain**.
4. Paste your domain and save.

### HTTP Error: 403, Permission denied on resource project...
Your CLI is trying to deploy to an old or deleted project. Follow the "Deploying to Production" steps above to switch to your new project ID.
