# Run Hunter Memory on your PC

## 1. Put the project on your Desktop

Extract/unzip so you have:

```
Desktop/Hunter-Memory/
  package.json
  src/
  ...
```

On Windows PowerShell (example if the zip is in Downloads):

```powershell
Expand-Archive -Path "$env:USERPROFILE\Downloads\hunter-memory-local.zip" -DestinationPath "$env:USERPROFILE\Desktop" -Force
```

You should end up with `Desktop\Hunter-Memory\package.json`.

## 2. Install Node.js

Install Node.js 20+ from https://nodejs.org (LTS).

Check:

```bash
node -v
npm -v
```

## 3. Install and run

```bash
cd ~/Desktop/Hunter-Memory   # macOS/Linux
# or: cd $env:USERPROFILE\Desktop\Hunter-Memory   # Windows PowerShell

npm install
npm run dev
```

Open http://127.0.0.1:43217/

App data (jobs, applications, resume) is stored at:

`Desktop/Hunter-Memory/store.json` (preferred) or `Desktop/Hunter-Memory/data/store.json`.

## 4. Optional: clone from git instead of zip

If you created a GitHub/Origin repo from this project:

```bash
cd ~/Desktop
git clone <YOUR_REPO_URL> Hunter-Memory
cd Hunter-Memory
npm install
npm run dev
```
