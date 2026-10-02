# NextCut Studio — Free Persistent Storage Setup Guide

NextCut Studio's frontend is hosted on **GitHub Pages** (`https://nextlearnads-afk.github.io/Nex-cut-studio-/`).

Because GitHub Pages is a purely static host, video files and metadata cannot be written to GitHub Pages directly. NextCut Studio supports **two 100% free persistent storage solutions** that require **no credit card, no paid subscriptions, and no billing**:

---

## Option 1: Free Render.com Backend (Recommended)

NextCut Studio includes a complete Node.js/Express backend (`server.ts`) with chunked video uploads, HTTP 206 Partial Content Range streaming, persistent disk storage, and owner authentication.

### How to deploy to Render in 2 minutes (100% Free, No Credit Card):

1. Go to [https://render.com](https://render.com) and create a free account (Sign in with your GitHub account).
2. Click **New +** in the top navigation and select **Blueprint**.
3. Select your repository: `nextlearnads-afk/Nex-cut-studio-`.
4. Render automatically reads the included `render.yaml` file. Click **Apply**.
5. Once deployed (typically ~1-2 minutes), Render will assign you a free permanent HTTPS URL:
   ```
   https://nextcut-studio-backend-xxxx.onrender.com
   ```
6. **Connect your frontend:**
   - In NextCut Studio on GitHub Pages, click **Storage Setup** in the top navigation bar.
   - Paste your Render URL (`https://nextcut-studio-backend-xxxx.onrender.com`) and click **Save Configuration**.
   - *(Optional)* In your GitHub repository **Settings > Secrets and variables > Actions > Variables**, add `VITE_API_URL` with your Render URL so every future GitHub Pages build automatically bakes it in!

---

## Option 2: Free Cloudinary Media Storage (Instant, No Backend to Manage)

If you prefer direct-to-cloud video storage without deploying a Node server:

1. Sign up for a free account at [https://cloudinary.com](https://cloudinary.com) (25GB video storage, free forever, NO credit card required).
2. Go to **Settings > Upload > Upload presets**.
3. Click **Add upload preset**:
   - Set **Signing Mode** to **Unsigned**.
   - Set the preset name (e.g. `nexcut_preset`).
4. Click **Save**.
5. In NextCut Studio on GitHub Pages, click **Storage Setup** in the top bar:
   - Select **Free Cloudinary (25GB)**.
   - Enter your **Cloud Name** and **Upload Preset**.
   - Click **Save Configuration**.

---

## How It Works

- **Owner Uploads:** Videos are saved to persistent cloud storage with chunked upload, speed tracking, and ETA.
- **Client Link:** The generated link (`https://nextlearnads-afk.github.io/Nex-cut-studio-/watch/:videoId?api=...`) contains the secure reference to the video.
- **Client Views:** Any client on any phone, browser, or incognito window opens the link and streams the master cut in 100% original quality.
- **Owner Deletes:** When the owner clicks Delete, the video is permanently deleted from storage and metadata is invalidated. Subsequent visits display **"Video Not Available"**.
