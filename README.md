# Barbershop Mini App

Telegram Mini App for barbershop booking — monorepo with client app, admin panel, and Telegram bot.

## Structure

```
barbershop-miniapp/
├── apps/
│   ├── client/     # Telegram Mini App (React + Vite)
│   ├── admin/      # Admin panel (React + Vite)
│   └── bot/        # Telegram bot (Node.js + grammY)
├── packages/
│   └── shared/     # Shared TypeScript types and utilities
└── supabase/       # Database migrations and Edge Functions
```

## Stack

- **Frontend (client + admin):** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Bot:** grammY (Node.js)
- **Hosting:** Vercel (client + admin), Railway (bot)

## Getting Started

1. Copy `.env.example` to `.env` and fill in your values
2. Install dependencies: `npm install`
3. Run client: `npm run dev:client`
4. Run admin: `npm run dev:admin`
5. Run bot: `npm run dev:bot`
