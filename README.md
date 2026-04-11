# WID — What I Did

Application web de suivi et rééquilibrage des tâches domestiques.

## Stack

- **Frontend** : Next.js 16, React 19, Tailwind CSS 4, Zustand
- **Backend** : Supabase (PostgreSQL, Auth, RLS, Realtime)
- **Déploiement** : Vercel (auto-deploy depuis GitHub)

## Fonctionnalités

- Dashboard avec KPI (charge mentale, répartition, équité)
- Scoring automatique des tâches (4 axes : temps, physique, mental, impact)
- Quick Log (enregistrer une tâche effectuée en 2 taps)
- Échanges de tâches entre membres du foyer
- Objectif de répartition personnalisé + suggestions de rééquilibrage
- Mode vacances
- Notifications web

## Développement

```bash
cp .env.example .env.local  # Remplir les clés Supabase
npm install
npm run dev
```

## Production

https://wid-eight.vercel.app
