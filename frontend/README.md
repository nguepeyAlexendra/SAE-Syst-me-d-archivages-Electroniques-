# SAE — Système d'Archivage Électronique

Plateforme web interne de dépôt, organisation et recherche de documents, avec pipeline ETL automatisé et recherche full-text.

## Stack technique

| Technologie | Usage |
|---|---|
| **React 19** | Frontend |
| **TypeScript** | Langage |
| **Vite 8** | Build tool |
| **Tailwind CSS 4** | Styles |
| **shadcn/ui** | Composants UI (Radix primitives) |
| **Recharts** | Graphiques admin |
| **Axios** | Client HTTP |
| **React Router 7** | Routage |

## Architecture

```
src/
├── api/               # Appels API typés
│   ├── client.ts      # Axios instance + intercepteur JWT
│   ├── auth.ts        # Auth (connexion, profil, mot de passe)
│   ├── documents.ts   # Documents CRUD
│   ├── admin.ts       # Admin (stats, utilisateurs, catégories, config)
│   └── recherche.ts   # Recherche full-text
├── components/
│   ├── ui/            # shadcn/ui components (Button, Card, Table, Dialog, etc.)
│   ├── Layout.tsx     # Layout avec sidebar navigation
│   ├── RouteProtegee.tsx  # Garde d'authentification
│   └── PipelineTimeline.tsx  # Timeline ETL
├── contexts/
│   └── AuthContext.tsx # Contexte d'authentification
├── hooks/
│   └── usePipelinePolling.ts  # Polling pipeline ETL
├── lib/
│   └── utils.ts       # Utilitaire cn()
├── pages/
│   ├── auth/          # Connexion
│   ├── dashboard/     # Dashboard Personnel + Admin
│   ├── documents/     # Dépôt, Liste, Détail, Recherche
│   ├── profil/        # Profil (infos, sécurité, historique, notifications)
│   ├── admin/         # Utilisateurs, Catégories, Configuration
│   └── errors/        # 403, 404
└── App.tsx            # Routes principales
```

## Routes

| Route | Page | Accès |
|---|---|---|
| `/connexion` | Connexion | Public |
| `/dashboard` | Dashboard Personnel | Auth |
| `/admin` | Dashboard Admin | Auth + Admin |
| `/depot` | Déposer un document | Auth |
| `/documents` | Liste des documents | Auth |
| `/documents/:id` | Détail d'un document | Auth |
| `/recherche` | Recherche full-text | Auth |
| `/profil` | Mon profil | Auth |
| `/admin/utilisateurs` | Gestion utilisateurs | Admin |
| `/admin/categories` | Catégories & Tags | Admin |
| `/admin/logs` | Logs d'activité | Admin |
| `/admin/configuration` | Configuration système | Admin |

## Fonctionnalités

- **Authentification** par email + mot de passe avec notification d'erreur
- **Authentification à deux facteurs (2FA)** : activation par l'utilisateur ou imposée par l'admin
- **Réinitialisation de mot de passe** par un administrateur (rubrique sécurité de l'utilisateur)
- **Dépôt** par glisser-déposer ou scan, avec suivi pipeline ETL en temps réel
- **Pipeline ETL** : vérification format → antivirus → extraction métadonnées → classement → indexation
- **Causes de rejet bilingues** (fr/en) stockées côté serveur et affichées selon la langue de l'interface
- **Recherche** full-text avec filtres (catégorie, statut, type, date, tri)
- **Dashboard** avec statistiques, graphiques, documents récents
- **Internationalisation complète (Français / English)** : bascule instantanée, pages d'erreur incluses
- **Gestion des utilisateurs** : création, rôles, désactivation, réinitialisation de mot de passe
- **Catégories & Tags** : CRUD avec code couleur
- **Domaines e-mail autorisés** pour l'inscription et le partage
- **Logs d'activité admin** : filtres (type, date, tri), export CSV/Excel, pagination
- **Configuration système** : règles dépôt, pipeline, état des services, top causes de rejet, stockage disque vs MinIO
- **Profil** : photo, mot de passe (avec toggle visibilité), 2FA, historique paginé, notifications
- **Partage** de documents par e-mail et en ligne

## Développement

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # Production build
npm run lint    # ESLint
```

## Backend

Le backend Django se trouve dans `/backend`.
- API REST sur `/api/`
- Authentification par token
- Pipeline ETL asynchrone
- Stockage fichiers sur NAS / MinIO

## Installation sur une nouvelle machine

1. Dépendances :
   pip install -r backend/requirements.txt
   cd frontend && npm install

2. LibreOffice (miniatures des documents Office) :
   python scripts/install_libreoffice.py

3. Assistant IA (RAG, 100% local) :
   python scripts/install_rag.py

   Modèles téléchargés :
- `nomic-embed-text` : embeddings (~270 Mo)
- `llama3.2:3b` : génération de réponses en français (~2 Go)

