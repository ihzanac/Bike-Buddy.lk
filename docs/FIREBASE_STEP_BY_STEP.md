# Firebase setup (step by step)

This guide walks you from zero to a working **Bike Service & Marketplace** project with **Firebase Authentication**, **Firestore** (database), and **Storage** (images). You need a **Google account**.

### Using Firebase for free (Spark plan)

This app only needs **Authentication**, **Firestore**, and **Storage**. All of that works on the **no-cost Spark plan** for normal learning and small demos.

- **Do not** add a payment method or click **Upgrade** unless you choose to. New projects start on Spark unless you switch to Blaze.
- In Firebase Console: **Project settings** (gear) → **Usage and billing** shows your plan. **Spark** = free quotas.
- **Auth, Firestore rules, Storage rules, and Publish** do not require payment by themselves.
- You get **free monthly quotas** (storage space, downloads, document reads/writes, etc.). Stay within them for hobby use; the console shows **Usage** if you are curious.
- **This codebase does not use Cloud Functions**, so you are not forced onto Blaze for serverless functions.
- If Firebase ever asks you to **upgrade to Blaze**, read the message: sometimes only one feature needs it. For this Vite app on your PC, you usually do **not** need Blaze to develop.

---

## Part 1: Create a Firebase project

1. Open **[Firebase Console](https://console.firebase.google.com/)** and sign in with Google.
2. Click **Add project** (or **Create a project**).
3. Enter a project name (for example `bike-system`) and continue.
4. Google Analytics is optional. You can turn it off for simplicity.
5. Click **Create project** and wait until it finishes, then click **Continue**.

You now have an empty Firebase project.

---

## Part 2: Register a Web app and copy config into `.env`

1. In the Firebase project home, click the **Web** icon (`</>`) labeled something like **Add app** or under “Get started by adding Firebase to your app”.
2. Register the app with a nickname (for example `web`). You do not need Firebase Hosting for this step unless you want it later.
3. Firebase shows a **`firebaseConfig`** JavaScript object with keys like `apiKey`, `authDomain`, `projectId`, etc.

4. On your computer, in the project folder `System bike 00`, copy `.env.example` to `.env` if you have not already.

5. Fill **six** variables in `.env` (names must match exactly):

| In `.env` | Copy from Firebase `firebaseConfig` |
|-----------|--------------------------------------|
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

6. **Important spelling:** the variable must be `VITE_FIREBASE_APP_ID` (not `VITE_FIREFIREBASE_APP_ID`).

7. Save `.env`. No spaces around `=` unless your value needs quotes.

---

## Part 3: Turn on Authentication (email and password)

1. In the left menu, open **Build → Authentication**.
2. If you see **Get started**, click it.
3. Open the **Sign-in method** tab.
4. Click **Email/Password**, turn **Enable** on, and **Save**.

Users can now register and log in with email and password.

### If you run Node scripts (`bootstrap:demo-users`, `seed:firestore`)

Google Cloud may restrict your **API key** to websites only. Node has no “website referrer”, so Auth can fail with `auth/configuration-not-found`.

1. Open **[Google Cloud Console](https://console.cloud.google.com/)** and select **the same project** as Firebase (top bar project picker).
2. Go to **APIs & Services → Credentials**.
3. Open the **Browser key** that matches your `VITE_FIREBASE_API_KEY`.
4. Under **Application restrictions**, for local development choose **None**, or **IP addresses** and add your PC’s IP. Save.

For production you can use a separate key for server scripts. See the main **README** for a short troubleshooting note.

---

## Part 4: Create Firestore (the database)

1. In Firebase, open **Build → Firestore Database**.
2. Click **Create database**.
3. Choose a location close to you.
4. For learning, you can start in **production mode** if you will deploy **security rules** from this repo right away (recommended). If you pick **test mode**, remember to deploy rules before going live.

5. After the database exists, deploy the rules from this repository:
   - File: **`firestore.rules`** at the project root.
   - In Firebase: **Firestore Database → Rules** tab, paste the contents of `firestore.rules`, click **Publish**.

6. Deploy **indexes** (or wait until the app shows a link to create a missing index):
   - File: **`firestore.indexes.json`**
   - If you use Firebase CLI: `npm run firebase:deploy:rules` (see **README**) also deploys indexes when configured.

Without correct rules, the app may show “permission denied” in the browser console.

---

## Part 5: Turn on Storage (for shop images)

1. Open **Build → Storage**.
2. Click **Get started**, accept defaults, complete the wizard.
3. Deploy rules from **`storage.rules`** in this repo: **Storage → Rules**, paste, **Publish**.

---

## Part 6: Run your app on your computer

1. Open a terminal in the project folder.
2. Run:

```bash
npm install
```

3. Check Firestore connectivity:

```bash
npm run check:firebase
```

You want: `OK — Firestore is reachable.`

4. Start the app:

```bash
npm run dev
```

5. Open the URL shown (often `http://localhost:5173`).

---

## Part 7: Create demo users and sample data (optional but useful)

1. Make sure **Email/Password** is enabled and **API key restrictions** allow your machine if you use scripts (Part 3).
2. Make sure **`firestore.rules`** in the console includes the **admin@bikehub.demo** bootstrap rule (use the file from this repo).
3. Run:

```bash
npm run bootstrap:demo-users
```

4. That creates three accounts and sample **bikes**, **accessories**, and **services** in Firestore. Log in at **`/login`** with:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@bikehub.demo` | `DemoPass123!` |
| Customer | `customer@bikehub.demo` | `DemoPass123!` |
| Shop owner | `owner@bikehub.demo` | `DemoPass123!` |

If the script fails, read the error in the terminal and compare with **README** (Auth and API key sections).

---

## Part 8: What you have in Firebase (mental model)

- **Authentication:** list of users (email/password). Each user has a **UID**.
- **Firestore:** “tables” are **collections** (`users`, `bikes`, `accessories`, `services`, `bookings`). Each row is a **document**.
- **Storage:** files (images). The app stores **download URLs** inside Firestore on bike/accessory documents.

There is no SQL “CREATE TABLE” button. Collections appear when the **first document** is written (by the app or by you in the console).

---

## Part 9: If something goes wrong

| Symptom | What to check |
|---------|----------------|
| Blank “Firebase not configured” page | `.env` missing or empty `VITE_FIREBASE_*` values; restart `npm run dev` after editing `.env`. |
| `auth/configuration-not-found` in a script | Email/Password enabled; API key not blocked for Node (Part 3). |
| `permission-denied` in browser | `firestore.rules` deployed; user logged in; owner **approved** for owner actions. |
| `permission-denied` right after `bootstrap:demo-users` prints **Created** for all three | **Publish** the full `firestore.rules` from this repo in the console (not an older draft). If **App Check** enforces Firestore, turn enforcement off for dev or the Node script cannot write. The bootstrap script prints more detail on failure. |
| “Missing index” link in console | Open the link and create the composite index, or deploy `firestore.indexes.json`. |

---

## Next steps

- Browse **Firestore → Data** in the console after bootstrap to see documents.
- Read **`README.md`** for scripts (`seed:firestore`, `firebase:deploy:rules`, etc.).
- For field-by-field reference, see the earlier “collections and fields” summary or `src/types/index.ts`.
