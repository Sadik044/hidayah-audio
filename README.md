[README.md](https://github.com/user-attachments/files/34201797/README.md)
<div align="center">

# 🎧 Hidayah Audio

**A modern audio web app built with React, TypeScript and Supabase.**

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen?style=for-the-badge)](https://hidayah-audio.vercel.app)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-backend-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

[Live Demo](https://hidayah-audio.vercel.app) · [Report a Bug](https://github.com/Sadik044/hidayah-audio/issues) · [Request a Feature](https://github.com/Sadik044/hidayah-audio/issues)

</div>

---

## 📖 About

**Hidayah Audio** is a fast, responsive single-page web application for listening to and managing audio content. The frontend is built with **React 19 + Vite + TypeScript** and styled with **Tailwind CSS**, while **Supabase** provides the backend services.

> 🌐 **Try it live:** [hidayah-audio.vercel.app](https://hidayah-audio.vercel.app)

<!-- TODO: Add a screenshot or GIF of the app here.
     Example: ![Hidayah Audio Screenshot](./docs/screenshot.png) -->

## ✨ Features

<!-- TODO: Replace/extend this list with the actual features of your app. -->

- 🎵 Audio browsing and playback
- 📱 Fully responsive UI, works on mobile and desktop
- ⚡ Lightning-fast development and builds powered by Vite
- 🎨 Clean, utility-first styling with Tailwind CSS
- 🧭 Client-side routing with React Router
- ☁️ Supabase-powered backend (database, auth and storage ready)
- 🔒 Environment-based configuration, no secrets committed

## 🛠️ Tech Stack

| Layer      | Technology                                                                 |
| ---------- | -------------------------------------------------------------------------- |
| Framework  | [React 19](https://react.dev/)                                             |
| Language   | [TypeScript](https://www.typescriptlang.org/)                              |
| Build Tool | [Vite](https://vite.dev/)                                                  |
| Styling    | [Tailwind CSS](https://tailwindcss.com/), `clsx`, `tailwind-merge`         |
| Routing    | [React Router](https://reactrouter.com/)                                   |
| Icons      | [Lucide React](https://lucide.dev/)                                        |
| Backend    | [Supabase](https://supabase.com/) via `@supabase/supabase-js`              |
| Hosting    | [Vercel](https://vercel.com/)                                              |

## 📂 Project Structure

```
hidayah-audio/
├── public/              # Static assets served as-is
├── src/                 # Application source code
├── supabase/            # Supabase configuration / database setup
├── .env.example         # Template for environment variables
├── index.html           # App entry HTML
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # Tailwind configuration
├── postcss.config.js    # PostCSS configuration
└── tsconfig*.json       # TypeScript configuration
```

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) **18 or newer** (20+ recommended)
- npm (comes with Node.js)
- A free [Supabase](https://supabase.com/) project

### 1. Clone the repository

```bash
git clone https://github.com/Sadik044/hidayah-audio.git
cd hidayah-audio
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your own Supabase credentials:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
```

You can find both values in your Supabase dashboard under **Project Settings → API**.

> ⚠️ **Security note:** Only use the public `anon` / publishable key in the frontend.
> **Never** put your `service_role` key or any other secret in a `VITE_` variable. Anything prefixed with `VITE_` is exposed to the browser.

### 4. Set up the database

The `supabase/` folder contains the backend setup for this project. Apply it to your Supabase project (via the Supabase SQL Editor or the [Supabase CLI](https://supabase.com/docs/guides/local-development)) before running the app.

### 5. Start the dev server

```bash
npm run dev
```

Open the URL printed in your terminal (usually `http://localhost:5173`).

## 📜 Available Scripts

| Command           | Description                                        |
| ----------------- | -------------------------------------------------- |
| `npm run dev`     | Start the Vite development server with hot reload  |
| `npm run build`   | Type-check with `tsc` and create a production build |
| `npm run preview` | Preview the production build locally               |

## ☁️ Deployment

The app is deployed on **Vercel**. To deploy your own copy:

1. Fork this repository.
2. Import it into [Vercel](https://vercel.com/new).
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Settings → Environment Variables**.
4. Deploy. Vercel auto-detects Vite and uses `npm run build`.

## 🤝 Contributing

Contributions, issues and feature requests are welcome!

1. Fork the project
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m "Add amazing feature"`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 🗺️ Roadmap

<!-- TODO: Update with your real plans. -->

- [ ] Add screenshots and demo GIF
- [ ] Add automated tests
- [ ] Add CI workflow (lint, type-check, build)

## 📄 License

<!-- TODO: Add a LICENSE file (e.g. MIT) and update this section. -->

No license has been specified yet. Add a `LICENSE` file to let others know how they can use this project.

## 👤 Author

**Sadik**

- GitHub: [@Sadik044](https://github.com/Sadik044)

---

<div align="center">

If you like this project, consider giving it a ⭐ on GitHub!

</div>
