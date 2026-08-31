# SAE — Spécification système pour génération de diagrammes Mermaid

> Colle ce document dans Mermaid AI (ou tout agent capable de générer du Mermaid) et demande les 5 diagrammes :
> **diagramme de classes, diagramme de cas d'utilisation, diagrammes de séquence, diagramme d'états-transitions, diagramme d'activités**.
> Le document décrit fidèlement le système « SAE — Système d'Archivage Électronique ».

---

## 1. Contexte et technologie

SAE est une plateforme web interne de dépôt, organisation, traitement et recherche de documents d'entreprise.

- **Backend** : Django + Django REST Framework (3 applications : `accounts`, `documents`, `notifications`), base SQLite, stockage fichiers local + **MinIO**, authentification par **jeton (DRF Token)**.
- **Frontend** : React 19 + TypeScript + Vite + Tailwind CSS, bibliothèque de composants shadcn/ui, Recharts pour les graphiques admin, polling en temps réel du pipeline ETL.
- **Acteurs du système** :
  - **Employé** : utilisateur standard rattaché à un département, accès restreint.
  - **Administrateur** (`is_staff`) : gestion complète (utilisateurs, départements, documents, configuration).
  - **Système / Pipeline ETL** : traitement asynchrone automatique des fichiers déposés.
  - **Visiteur (anonyme)** : accès public limité à la page de connexion et à la vérification d'email.

## 2. Architecture des API (préfixe `/api/`)

| Préfixe | Rôle |
|---|---|
| `api/auth/` | Connexion, vérification 2FA, profil, changement de mot de passe, gestion admin des utilisateurs, domaines email autorisés, mot de passe oublié (backend) |
| `api/documents/` | Documents (liste, détail, favoris, archiver, désarchiver, partager), logs, stats serveur, stats MinIO |
| `api/notifications/` | Notifications in-app de l'utilisateur connecté (liste + marquer lue) |
| `api/categories/`, `api/tags/` | CRUD catégories et tags |
| `api/departements/` | CRUD départements, assignation d'utilisateurs, gestion des accès inter-départements |
| `api/admin/stats/`, `api/admin/configuration/`, `api/admin/utilisateurs/`, `api/admin/documents/permissions/` | Statistiques, configuration, utilisateurs, permissions |

## 3. Modèle de données (diagramme de classes)

### Application `accounts`
- **User** (Django natif) : `username`, `email`, `password`, `is_staff` (admin), `is_active`, `is_superuser`.
- **ProfilUtilisateur** (1:1 avec User, créé automatiquement via signal) : `photo`, `telephone`, `two_fa_active`, `changement_mdp_obligatoire`, `code_2fa`, `code_2fa_expiration`, `token_2fa_temporaire`, `tentatives_2fa_echouees`, `date_derniere_demande_code`, `nb_codes_envoyes_heure`, FK `departement` (PROTECT), M2M `departements_autorises`.
- **DomaineEmail** : `domaine` (unique), `actif`, `date_ajout`. Sert à restreindre les emails acceptés.
- **ConfigurationConnexion** (singleton, pk=1) : `domaine_email_autorise` (obsolete), `two_fa_obligatoire` (imposer le 2FA à tous), FK `modifie_par`, `derniere_modification`.
- **AppareilApprouve** : FK `utilisateur`, `token` (unique), `nom_appareil`, `date_creation`, `date_expiration` (30 jours). Permet d'éviter le 2FA sur un appareil de confiance.

### Application `documents`
- **Departement** : `nom` (unique), `nom_en`, `description`. Membres via `ProfilUtilisateur.departement`.
- **Categorie** : `nom` (unique), `description`.
- **Tag** : `nom` (unique), `couleur`.
- **Document** : `titre`, `fichier`, `miniature`, `type_source` (numerique/scan), FK `depose_par` (User), `date_depot`, `date_derniere_modification`, `taille_fichier`, `type_mime`, `groupe` (documents/images/medias), `auteur_document`, FK `categorie`, FK `departement`, M2M `tags`, `largeur_px`, `hauteur_px`, `duree`, `contenu_texte`, `statut` (en_attente/en_cours/valide/rejete), `log_pipeline` (JSON d'étapes ETL), `cause_rejet` (FR), `cause_rejet_en` (EN), `est_confidentiel`, M2M `utilisateurs_autorises`, M2M `departements_autorises`, `est_epingle`, `tentative_count`, `est_archive`, M2M `favoris`, `est_supprime`, `date_suppression`.
- **LogAction** : FK `document`, `type_action` (archivage/rejet/validation/modification/partage), `cause`, `cause_en`, FK `effectue_par` (User), `date_action`.
- **ConnexionLog** : FK `utilisateur`, `ip_address`, `user_agent`, `date_connexion`.
- **StorageSnapshot** : `date` (unique), `disk_used_gb`, `disk_total_gb`, `minio_used_gb` — historique 30 jours du stockage.

### Application `notifications`
- **Notification** : FK `destinataire` (User), `message`, `type_notification` (validation/rejet/acces_accorde), FK `document`, `lue`, `date_creation`, `email_envoye`, `date_envoi_email`.
  - Note : le modèle et les endpoints existent, mais la **création automatique des notifications n'est pas encore câblée** dans le code.

## 4. Règles métier importantes

### Authentification et 2FA
- Connexion par email + mot de passe. Si identifiants invalides → 401 avec message d'erreur.
- Le 2FA (code à 6 chiffres envoyé par email) est **requis** si : l'utilisateur est admin (`is_staff`), OU `ConfigurationConnexion.two_fa_obligatoire` est vrai, OU `ProfilUtilisateur.two_fa_active`.
- Code 2FA : valable 5 minutes, 3 tentatives maximales, **rate limiting** de 3 codes par heure.
- Option « se souvenir de l'appareil » : crée un `AppareilApprouve` valable 30 jours qui contourne le 2FA.
- Premier mot de passe fourni par l'admin → `changement_mdp_obligatoire` = vrai → l'utilisateur doit le changer à la connexion.
- La réinitialisation du mot de passe par l'admin invalide les jetons existants et force le changement au prochain login.
- « Mot de passe oublié » : endpoints backend existants (envoi de code par email), pages retirées du frontend.

### Permissions sur les documents
- **Employé** : ne voit que les documents de son département + des départements autorisés (`departements_autorises`) + les documents dont `departements_autorises` contient son département. Les documents **confidentiels** ne sont visibles que par le déposant et les utilisateurs explicitement autorisés. Les documents **rejetés** sont exclus de la liste. Un employé ne peut déposer que dans **son propre** département et ne peut pas modifier les documents des autres départements (accès en lecture seule).
- **Administrateur** : voit tous les documents (y compris inter-départements et confidentiels), peut modifier, archiver/désarchiver, gérer les permissions (confidentialité, utilisateurs et départements autorisés, en masse).

### Dépôt et pipeline ETL (asynchrone)
Étapes successives du traitement d'un fichier :
1. **Vérification du format** : détection MIME réelle (`magic`), correction HEIC/HEIF (iPhone). Si MIME non autorisé → **rejet** « Format non autorisé ».
2. **Vérification du groupe attendu** (documents / images / medias). Si le groupe réel diffère du groupe attendu pour le formulaire → **rejet** « Format incorrect pour ce formulaire ».
3. **Scan antivirus** : recherche de la signature de test **EICAR** dans le contenu. Si détectée → **rejet** « Signature virale détectée ».
4. **Extraction des métadonnées** : dimensions (PIL pour images), durée (Mutagen pour audio/vidéo), taille.
5. **Tagging automatique contextuel** : tags selon le type MIME réel (PDF, JPEG, Excel…) et la source (scan → « Scanné »).
6. **Génération de la miniature** : 1re page pour les PDF (PyMuPDF).
7. **Chargement final** (stockage validé/MinIO) → statut **valide**, `LogAction` de validation.
- Chaque étape est consignée dans `Document.log_pipeline` (étapes : format, antivirus, metadonnees, tagging, miniature, chargement) avec horodatage et statut (en_cours/termine/echec).
- Chaque rejet crée un `LogAction` de type `rejet` avec la **cause bilingue** (FR/EN).
- Type de log `partage` : créé lors du partage par email. Le type `modification` est défini mais n'est pas produit actuellement.

### Administration
- Gestion des **utilisateurs** : création (mot de passe temporaire généré + email HTML), activation/désactivation, attribution/retrait du rôle admin, réinitialisation du mot de passe, assignation au département principal, **accès inter-départements** (donner/révoquer un accès de son département vers les membres d'autres départements).
- Gestion des **départements** : CRUD, nom anglais, liste des membres, assigner/retirer.
- Gestion des **catégories et tags** : CRUD.
- Gestion des **domaines email autorisés** : CRUD + activation/désactivation en masse (uniquement les utilisateurs dont l'email correspond à un domaine actif peuvent être inscrits/partager).
- **Configuration connexion** : imposer le 2FA à tous.
- **Logs d'activité** : filtres (type, recherche, dates, tri), export CSV/Excel, pagination.
- **Statistiques** : totaux (valides, rejetés, en cours, confidentiels), répartition par département et catégorie, top 5 des causes de rejet (bilingue), activité hebdomadaire, stats serveur (CPU, RAM, disque, MinIO, connexions 24 h, historique de stockage 30 jours).

### Partage
- Un utilisateur peut partager un document **par email** : envoi d'un email HTML avec lien vers le document et pièce jointe, log de type `partage`. Vérification des droits d'accès avant envoi.

## 5. Machine à états du Document (diagramme d'états-transitions)

- `en_attente` (dépôt du fichier)
- → `en_cours` (pipeline ETL démarré, `tentative_count` incrémenté)
- → `valide` (toutes les étapes ETL réussies) ou `rejete` (échec format / groupe / virus, cause enregistrée, terminal pour le pipeline)
- `valide` → `archive` (action admin : `est_supprime = true`, `date_suppression` renseignée, `LogAction` archivage)
- `archive` → `valide` (action admin : désarchivage)

## 6. Principaux flux (diagrammes de séquence)

### Flux A — Connexion avec 2FA
Employé → Frontend → `POST /api/auth/connexion/` :
1. Vérification des identifiants.
2. Décision 2FA (admin / 2FA global / 2FA utilisateur).
3. Si non requis : création du jeton + `ConnexionLog`, réponse `{token, utilisateur}`.
4. Si requis et **appareil approuvé** valide : connexion directe.
5. Sinon : contrôle du rate limit (3 codes/heure) → génération d'un code à 6 chiffres + `temp_token` (5 min) → envoi par email → réponse `{status: "2fa_required", temp_token}`.
6. Employé saisit le code → `POST /api/auth/verify-2fa/` → vérifications (blocage à 3 tentatives, expiration) → succès : nettoyage, création du jeton, option « se souvenir de l'appareil » (création `AppareilApprouve`, 30 jours) → réponse `{token, trusted_device_token?, utilisateur}`.
7. Si `changement_mdp_obligatoire` : redirection vers l'écran de changement de mot de passe.

### Flux B — Dépôt d'un document + pipeline ETL
Employé → Frontend → `POST /api/documents/` (multipart, `groupe_attendu`) :
1. Création du `Document` (statut `en_attente`, `depose_par`).
2. `executer_pipeline(document, groupe_attendu)` : statut `en_cours`, puis les 7 étapes ETL (voir section 4).
3. En cas de rejet à n'importe quelle étape : statut `rejete`, cause FR/EN, `LogAction` de rejet.
4. En cas de succès : statut `valide`, `LogAction` de validation.
5. Le frontend **polls** `GET /api/documents/<id>/` pour afficher la timeline ETL en temps réel (success/échec).

### Flux C — Partage d'un document par email
Employé → Frontend → `POST /api/documents/<id>/partager/` :
1. Vérification des droits (département / confidentialité).
2. Construction de l'email HTML (lien vers `/documents/<id>` + pièce jointe + message optionnel).
3. Envoi de l'email.
4. Création d'un `LogAction` de type `partage` (cause bilingue).

## 7. Diagramme d'activités — Pipeline ETL

Activité principale : « Traiter un document déposé ».
- Début : fichier reçu.
- Étape 1 Vérification du format (MIME réel + correction HEIC).
- Décision : format autorisé ? Non → Rejet « Format non autorisé ». Oui → continuer.
- Vérification du groupe attendu.
- Décision : groupe conforme ? Non → Rejet « Format incorrect pour ce formulaire ». Oui → continuer.
- Étape 2 Scan antivirus (signature EICAR).
- Décision : virus détecté ? Oui → Rejet « Signature virale détectée ». Non → continuer.
- Étape 3 Extraction des métadonnées (dimensions / durée / taille).
- Étape 4 Tagging automatique contextuel.
- Décision : fichier PDF ? Oui → Étape 5 Génération de la miniature (1re page). Non → continuer.
- Étape 6 Chargement final (stockage/MinIO).
- Fin : document validé et indexé.
- Toute branche de rejet se termine par : enregistrement de la cause bilingue + `LogAction` de rejet.

## 8. Points d'attention pour la fidélité des diagrammes

- **Cas d'utilisation** : 4 acteurs (Employé, Administrateur, Pipeline ETL/Système, Visiteur anonyme). Mermaid ne possède pas de diagramme de cas d'utilisation natif : utiliser un `flowchart` avec des acteurs en forme d'« acteur » (courbure `([...])`) et des cas en ovale `("...")`, regroupés par thème (Authentification, Documents, Administration, Pipeline).
- **Diagramme de classes** : représenter les relations clés (1:1 User→ProfilUtilisateur ; 1:N User→Document/LogAction/ConnexionLog/Notification/AppareilApprouve ; N:M ProfilUtilisateur↔Departement, Document↔Tag/User/Departement ; 1:N Departement→Document ; Document→LogAction ; Document→Notification).
- **Séquence** : les 3 flux décrits en section 6 (connexion 2FA, dépôt+ETL avec polling, partage email).
- **États** : la machine à états de la section 5.
- **Activité** : le pipeline ETL de la section 7.

---

*Fin de la spécification. Envoie ce document à Mermaid en demandant explicitement les 5 diagrammes.*
