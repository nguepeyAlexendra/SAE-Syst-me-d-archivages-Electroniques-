import { useState, useMemo } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Search, Mail, FileText, Bot, Star, Shield, Wrench, HelpCircle,
  Rocket, Printer, FolderSearch, Share2, Bell, Lock, Key,
  Upload, CheckCircle2, AlertCircle, Info, Lightbulb, Users,
  Settings, Database, BookOpen, AlertTriangle
} from "lucide-react"

// ============================================================================
// COMPOSANTS RÉUTILISABLES
// ============================================================================

function InfoBox({ type = "info", title, children }: { 
  type?: "info" | "warning" | "success" | "tip"
  title?: string
  children: React.ReactNode 
}) {
  const config = {
    info: { icon: Info, className: "border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20" },
    warning: { icon: AlertTriangle, className: "border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20" },
    success: { icon: CheckCircle2, className: "border-l-4 border-green-500 bg-green-50 dark:bg-green-950/20" },
    tip: { icon: Lightbulb, className: "border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-950/20" }
  }
  const { icon: Icon, className } = config[type]
  
  return (
    <div className={`rounded-r-lg p-4 my-4 ${className}`}>
      <div className="flex gap-3 items-start">
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1">
          {title && <p className="font-semibold mb-1 text-sm">{title}</p>}
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </div>
  )
}

function StepCard({ number, title, children }: { 
  number: number
  title: string
  children: React.ReactNode 
}) {
  return (
    <div className="flex gap-4 mb-6">
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
          {number}
        </div>
        <div className="w-0.5 flex-1 bg-border mt-2" />
      </div>
      <div className="flex-1 pb-2">
        <h4 className="font-semibold mb-2 text-sm">{title}</h4>
        <div className="text-sm text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

function LevelBadge({ level }: { level: "debutant" | "intermediaire" | "avance" }) {
  const config = {
    debutant: { label: "Débutant", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    intermediaire: { label: "Intermédiaire", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    avance: { label: "Avancé", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" }
  }
  const { label, color } = config[level]
  return <Badge className={color}>{label}</Badge>
}

// ============================================================================
// DONNÉES - ONGLET GUIDES
// ============================================================================

const guidesData = [
  {
    id: "deposer-document",
    icon: Upload,
    title: "Déposer un document",
    description: "Depuis le navigateur ou le scanner",
    level: "debutant" as const,
    content: `
<h3 class="text-base font-semibold mb-3">Méthode 1 : Navigateur</h3>

<StepCard number={1} title="Accéder à la zone de dépôt">
Cliquez sur "Nouveau dépôt" ou accédez à /depot.
</StepCard>

<StepCard number={2} title="Choisir le groupe">
Sélectionnez le type de fichier :
<ul class="list-disc list-inside space-y-1 mt-2">
<li><strong>Documents</strong> : PDF, Word, Excel, PowerPoint, TXT</li>
<li><strong>Images</strong> : JPEG, PNG, TIFF, HEIC</li>
<li><strong>Médias</strong> : MP3, MP4, WAV, AVI</li>
</ul>
</StepCard>

<StepCard number={3} title="Glisser-déposer">
Glissez vos fichiers dans la zone prévue ou cliquez pour parcourir. Taille maximale : 50 Mo par fichier.
</StepCard>

<StepCard number={4} title="Métadonnées">
<ul class="list-disc list-inside space-y-1">
<li><strong>Titre</strong> : nom descriptif</li>
<li><strong>Tags</strong> : mots-clés pour la recherche</li>
<li><strong>Confidentiel</strong> : accès restreint</li>
</ul>
</StepCard>

<StepCard number={5} title="Traitement automatique">
Le système traite votre fichier en 5 étapes (2 à 10 secondes) :
<ol class="list-decimal list-inside space-y-1 mt-2">
<li>Vérification du type réel</li>
<li>Scan antivirus</li>
<li>Extraction des métadonnées</li>
<li>Création de la miniature</li>
<li>Préparation pour l'Assistant IA</li>
</ol>
</StepCard>

<h3 class="text-base font-semibold mb-3 mt-6">Méthode 2 : Scanner Canon</h3>

<StepCard number={1} title="Scanner vers le dossier partagé">
Sur le scanner, choisissez "Scan vers dossier" et sélectionnez "ScansSAE".
</StepCard>

<StepCard number={2} title="Importer dans le SAE">
Ouvrez le SAE, cliquez sur "Scanner", puis "Importer". Les scans multi-pages sont automatiquement assemblés en PDF.
</StepCard>

<h3 class="text-base font-semibold mb-3 mt-6">Formats acceptés</h3>
<table class="w-full text-sm border-collapse">
<thead>
<tr class="border-b">
<th class="text-left py-2">Groupe</th>
<th class="text-left py-2">Formats</th>
<th class="text-left py-2">Taille max</th>
</tr>
</thead>
<tbody>
<tr class="border-b">
<td class="py-2">Documents</td>
<td class="py-2">PDF, DOCX, XLSX, PPTX, TXT, RTF</td>
<td class="py-2">50 Mo</td>
</tr>
<tr class="border-b">
<td class="py-2">Images</td>
<td class="py-2">JPEG, PNG, TIFF, HEIC, HEIF</td>
<td class="py-2">50 Mo</td>
</tr>
<tr>
<td class="py-2">Médias</td>
<td class="py-2">MP3, MP4, WAV, AVI</td>
<td class="py-2">50 Mo</td>
</tr>
</tbody>
</table>

<InfoBox type="warning" title="Important">
Le système vérifie le type réel du fichier, pas seulement l'extension. Un fichier .exe renommé en .pdf sera rejeté.
</InfoBox>
`
  },
  {
    id: "retrouver-organiser",
    icon: FolderSearch,
    title: "Rechercher et organiser",
    description: "Filtres, favoris, sélection multiple",
    level: "intermediaire" as const,
    content: `
<h3 class="text-base font-semibold mb-3">Recherche simple</h3>
<p class="mb-4">Tapez un mot-clé dans la barre de recherche en haut. Les résultats s'affichent instantanément.</p>

<h3 class="text-base font-semibold mb-3">Filtres avancés</h3>
<p class="mb-2">Sur la page Documents, utilisez les filtres :</p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Département</li>
<li>Tags</li>
<li>Date de dépôt</li>
<li>Déposé par</li>
<li>Favoris uniquement</li>
</ul>

<h3 class="text-base font-semibold mb-3">Favoris</h3>
<p class="mb-4">Cliquez sur l'étoile à côté d'un document pour l'épingler. Retrouvez-les dans "Mes favoris".</p>

<h3 class="text-base font-semibold mb-3">Sélection multiple</h3>

<StepCard number={1} title="Sélectionner">
<ul class="list-disc list-inside space-y-1">
<li><strong>Ctrl + Clic</strong> : sélection multiple</li>
<li><strong>Shift + Clic</strong> : plage de documents</li>
<li><strong>Case à cocher</strong> : sélection individuelle</li>
</ul>
</StepCard>

<StepCard number={2} title="Actions groupées">
Une barre d'outils apparaît avec : Partager, Ajouter aux favoris, Archiver (admin).
</StepCard>

<h3 class="text-base font-semibold mb-3 mt-6">Aperçu</h3>
<ul class="list-disc list-inside space-y-1">
<li><strong>PDF</strong> : aperçu intégré</li>
<li><strong>Images</strong> : lightbox plein écran</li>
<li><strong>Word/Excel</strong> : aperçu PDF généré</li>
<li><strong>Vidéos/Audio</strong> : lecteur intégré</li>
</ul>
`
  },
  {
    id: "assistant-ia",
    icon: Bot,
    title: "Assistant IA",
    description: "Les 4 modes d'utilisation",
    level: "intermediaire" as const,
    content: `
<p class="mb-4">L'Assistant IA est accessible via le bouton flottant en bas à droite. Il répond à vos questions en se basant sur les documents auxquels vous avez accès.</p>

<InfoBox type="success" title="Sécurité">
L'IA ne voit que les documents auxquels vous avez accès. Elle ne peut pas lire les documents confidentiels d'autres départements.
</InfoBox>

<h3 class="text-base font-semibold mb-3 mt-6">Mode Chat</h3>
<p class="mb-2"><strong>Usage :</strong> Poser des questions précises avec sources citées.</p>
<p class="mb-2"><strong>Exemples :</strong></p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>"Quelle est la procédure de congés ?"</li>
<li>"Quels sont les budgets 2025 ?"</li>
</ul>
<p class="mb-4">L'IA recherche dans vos documents, génère une réponse et cite ses sources. Vous pouvez poser des questions de suivi.</p>

<h3 class="text-base font-semibold mb-3">Mode Résumé Global</h3>
<p class="mb-2"><strong>Usage :</strong> Résumer plusieurs documents à la fois.</p>
<p class="mb-4">Sélectionnez plusieurs documents et demandez un résumé. L'IA résume chaque document puis synthétise le tout.</p>

<h3 class="text-base font-semibold mb-3">Mode Recherche</h3>
<p class="mb-2"><strong>Usage :</strong> Trouver des extraits pertinents sans génération de texte.</p>
<p class="mb-4">Affiche les passages de documents classés par pertinence. Plus rapide pour une recherche factuelle.</p>

<h3 class="text-base font-semibold mb-3">Mode Analyse</h3>
<p class="mb-2"><strong>Usage :</strong> Auditer votre corpus de documents.</p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Doublons potentiels</li>
<li>Thèmes récurrents</li>
<li>Qualité des métadonnées</li>
<li>Activité (consultations, partages)</li>
</ul>

<h3 class="text-base font-semibold mb-3 mt-6">Sources</h3>
<p class="mb-2">Chaque réponse affiche les sources utilisées :</p>
<ul class="list-disc list-inside space-y-1">
<li>Titre du document</li>
<li>Extrait exact (surligné)</li>
<li>Score de pertinence</li>
<li>Lien vers le document original</li>
</ul>

<InfoBox type="tip" title="Conseil">
Cliquez sur une source pour voir le contexte complet dans le document original.
</InfoBox>
`
  },
  {
    id: "partager-collaborer",
    icon: Share2,
    title: "Partager et collaborer",
    description: "Email, permissions, confidentialité",
    level: "intermediaire" as const,
    content: `
<h3 class="text-base font-semibold mb-3">Partager par email</h3>

<StepCard number={1} title="Ouvrir le document">
Accédez au détail du document.
</StepCard>

<StepCard number={2} title="Cliquer sur Partager">
Bouton en haut à droite.
</StepCard>

<StepCard number={3} title="Saisir l'email">
Entrez l'adresse email (domaine autorisé) et un message optionnel.
</StepCard>

<StepCard number={4} title="Envoyer">
Un email HTML est envoyé avec le document en pièce jointe et un lien vers le SAE.
</StepCard>

<InfoBox type="info" title="Traçabilité">
Chaque partage est enregistré dans les logs d'audit.
</InfoBox>

<h3 class="text-base font-semibold mb-3 mt-6">Permissions spécifiques</h3>
<p class="mb-2">Pour les documents confidentiels :</p>

<StepCard number={1} title="Ouvrir les permissions">
Dans le détail du document, cliquez sur "Permissions".
</StepCard>

<StepCard number={2} title="Ajouter des utilisateurs">
Recherchez et ajoutez les utilisateurs autorisés.
</StepCard>

<StepCard number={3} title="Retirer des accès">
Cliquez sur la croix pour retirer l'accès.
</StepCard>

<h3 class="text-base font-semibold mb-3 mt-6">Documents confidentiels</h3>
<p class="mb-2">Visibles uniquement par :</p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Le déposant</li>
<li>Les utilisateurs autorisés</li>
<li>Les administrateurs</li>
</ul>

<InfoBox type="warning" title="Important">
L'Assistant IA respecte ces règles. Elle ne répond pas sur les documents auxquels vous n'avez pas accès.
</InfoBox>

<h3 class="text-base font-semibold mb-3 mt-6">Historique</h3>
<p>Toutes les actions sont enregistrées : dépôt, validation, rejet, partage, archivage, modification. Consultez l'onglet "Historique" du document.</p>
`
  },
  {
    id: "notifications",
    icon: Bell,
    title: "Notifications",
    description: "Types et gestion",
    level: "debutant" as const,
    content: `
<h3 class="text-base font-semibold mb-3">Types de notifications</h3>
<table class="w-full text-sm border-collapse mb-4">
<thead>
<tr class="border-b">
<th class="text-left py-2">Type</th>
<th class="text-left py-2">Déclencheur</th>
</tr>
</thead>
<tbody>
<tr class="border-b">
<td class="py-2">Validation</td>
<td class="py-2">Document déposé validé</td>
</tr>
<tr class="border-b">
<td class="py-2">Rejet</td>
<td class="py-2">Document rejeté avec motif</td>
</tr>
<tr class="border-b">
<td class="py-2">Accès accordé</td>
<td class="py-2">Accès à un document confidentiel</td>
</tr>
<tr>
<td class="py-2">Partage</td>
<td class="py-2">Document partagé avec vous</td>
</tr>
</tbody>
</table>

<h3 class="text-base font-semibold mb-3">Lire les notifications</h3>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Cliquez sur l'icône en haut à droite</li>
<li>Les non lues apparaissent en surbrillance</li>
<li>Le compteur affiche le nombre de non lues</li>
</ul>

<InfoBox type="tip" title="Astuce">
Les notifications sont in-app uniquement, pas envoyées par email.
</InfoBox>
`
  }
]

// ============================================================================
// DONNÉES - ONGLET FAQ
// ============================================================================

const faqData = [
  {
    id: "auth-2fa",
    title: "Authentification et 2FA",
    items: [
      {
        question: "Je n'ai pas reçu mon code 2FA",
        answer: `
<p class="mb-2">Le code est envoyé par email et valable 5 minutes.</p>
<ol class="list-decimal list-inside space-y-1 mb-4">
<li>Vérifiez vos spams</li>
<li>Attendez 1 à 2 minutes</li>
<li>Cliquez sur "Renvoyer le code" (max 3 tentatives/heure)</li>
</ol>

<InfoBox type="warning" title="Important">
Après 3 tentatives, attendez 1 heure avant de réessayer.
</InfoBox>

<p>Si le problème persiste, contactez l'administrateur.</p>
`
      },
      {
        question: "Éviter le code 2FA à chaque connexion",
        answer: `
<p class="mb-2">Lors de la saisie du code, cochez "Se souvenir de cet appareil pendant 30 jours".</p>
<p class="mb-2">Pour gérer vos appareils :</p>
<ul class="list-disc list-inside space-y-1">
<li>Mon Profil → Appareils</li>
<li>Révoquez l'accès à tout moment</li>
</ul>
`
      },
      {
        question: "Mot de passe oublié",
        answer: `
<ol class="list-decimal list-inside space-y-1 mb-4">
<li>Cliquez sur "Mot de passe oublié ?"</li>
<li>Saisissez votre email</li>
<li>Entrez le code reçu</li>
<li>Choisissez un nouveau mot de passe</li>
</ol>

<InfoBox type="info" title="Validité">
Le code est valable 15 minutes et utilisable une seule fois.
</InfoBox>
`
      },
      {
        question: "Compte bloqué",
        answer: `
<p class="mb-2">Causes possibles :</p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>3 tentatives échouées : attendez 15 minutes</li>
<li>Compte désactivé : contactez l'administrateur</li>
</ul>

<p>Vérifiez email, mot de passe, et caps lock avant de contacter le support.</p>
`
      }
    ]
  },
  {
    id: "depot-formats",
    title: "Dépôt et formats",
    items: [
      {
        question: "Pourquoi mon document a été rejeté ?",
        answer: `
<p class="mb-2">Consultez le détail du document pour la cause exacte.</p>
<p class="mb-2"><strong>Causes courantes :</strong></p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li><strong>Incohérence MIME</strong> : extension ≠ contenu réel</li>
<li><strong>Format non autorisé</strong> : type non permis pour le groupe</li>
<li><strong>Virus détecté</strong> : signature malveillante</li>
<li><strong>Fichier corrompu</strong> : extraction impossible</li>
<li><strong>Trop volumineux</strong> : dépasse 50 Mo</li>
</ul>

<InfoBox type="tip" title="Solution">
Convertissez en format standard (PDF, JPEG) avant de réessayer.
</InfoBox>
`
      },
      {
        question: "Déposer plusieurs fichiers à la fois",
        answer: `
<p class="mb-2"><strong>Oui.</strong> Glissez-déposez plusieurs fichiers ou sélectionnez-les avec Ctrl + Clic.</p>
<p class="mb-2"><strong>Limites :</strong></p>
<ul class="list-disc list-inside space-y-1">
<li>50 Mo par fichier</li>
<li>Même groupe (documents, images ou médias)</li>
<li>Traitement individuel</li>
</ul>

<InfoBox type="info" title="Suivi">
Chaque fichier a sa propre timeline de traitement.
</InfoBox>
`
      },
      {
        question: "Fichiers HEIC (iPhone)",
        answer: `
<p><strong>Oui.</strong> Les fichiers HEIC/HEIF sont automatiquement convertis en JPEG. Aucune action requise.</p>
`
      },
      {
        question: "Fichiers Word ou Excel",
        answer: `
<p class="mb-2">Traitements automatiques :</p>
<ol class="list-decimal list-inside space-y-1">
<li>Conversion en PDF pour l'aperçu</li>
<li>Extraction du texte pour la recherche</li>
<li>Création de la miniature</li>
</ol>
<p class="mt-2">Le fichier original est conservé et téléchargeable.</p>
`
      }
    ]
  },
  {
    id: "assistant-ia-faq",
    title: "Assistant IA",
    items: [
      {
        question: "L'IA peut-elle lire tous les documents ?",
        answer: `
<p class="mb-2"><strong>Non.</strong> L'IA respecte vos permissions :</p>
<p class="mb-2"><strong>Visible :</strong></p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Documents de votre département</li>
<li>Départements autorisés</li>
<li>Documents où vous êtes autorisé</li>
<li>Documents que vous avez déposés</li>
</ul>

<p class="mb-2"><strong>Invisible :</strong></p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Documents d'autres départements (sauf autorisation)</li>
<li>Documents confidentiels (sauf accès)</li>
<li>Documents archivés (sauf admin)</li>
</ul>

<InfoBox type="success" title="Sécurité garantie">
Sécurité au niveau des lignes : l'IA ne répond pas sur les documents auxquels vous n'avez pas accès.
</InfoBox>
`
      },
      {
        question: "L'IA est lente ou affiche une erreur",
        answer: `
<p class="mb-2"><strong>Causes possibles :</strong></p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Première utilisation : chargement du modèle (10-20s)</li>
<li>Question complexe : recherche longue</li>
<li>Problème technique : service indisponible</li>
</ul>

<p class="mb-2"><strong>Solutions :</strong></p>
<ul class="list-disc list-inside space-y-1">
<li>Attendez et réessayez</li>
<li>Reformulez simplement</li>
<li>Contactez l'administrateur si persistant</li>
</ul>

<InfoBox type="info" title="Délai">
Comptez 5 à 15 secondes selon la complexité.
</InfoBox>
`
      },
      {
        question: "L'IA peut-elle se tromper ?",
        answer: `
<p class="mb-2"><strong>Oui.</strong> Vérifiez toujours les sources :</p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Cliquez sur les sources citées</li>
<li>Comparez avec le document original</li>
<li>Vérifiez les informations importantes</li>
</ul>

<p class="mb-2"><strong>Limites :</strong></p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Ne comprend pas le contexte implicite</li>
<li>Peut mal interpréter les questions ambiguës</li>
<li>Ne raisonne pas comme un humain</li>
</ul>

<InfoBox type="warning" title="Important">
Utilisez les réponses comme aide à la décision, pas comme vérité absolue.
</InfoBox>
`
      }
    ]
  },
  {
    id: "depannage",
    title: "Dépannage",
    items: [
      {
        question: "La page ne se charge pas",
        answer: `
<ol class="list-decimal list-inside space-y-1 mb-4">
<li>Vérifiez votre connexion</li>
<li>Actualisez (F5)</li>
<li>Videz le cache (Ctrl + Shift + Suppr)</li>
<li>Essayez un autre navigateur</li>
<li>Redémarrez votre ordinateur</li>
</ol>

<p>Si persistant, notez le message d'erreur et l'URL, puis contactez l'administrateur.</p>
`
      },
      {
        question: "Je ne vois pas certains documents",
        answer: `
<p class="mb-2"><strong>Causes possibles :</strong></p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li><strong>Permissions</strong> : demandez accès à l'administrateur</li>
<li><strong>Filtres actifs</strong> : réinitialisez les filtres</li>
<li><strong>Archivés</strong> : visibles uniquement par les admins</li>
</ul>

<InfoBox type="tip" title="Astuce">
Utilisez la recherche globale pour trouver des documents hors de votre département.
</InfoBox>
`
      },
           {
        question: "Supprimer un document",
        answer: `
<p class="mb-2"><strong>Utilisateurs :</strong> Il n'est pas possible de supprimer un document depuis l'interface. L'archivage est géré exclusivement par les administrateurs.</p>

<p class="mb-2 mt-4"><strong>Administrateurs :</strong> La suppression définitive d'un document (fichier et métadonnées) ne se fait pas depuis l'interface web.</p>
<p class="mb-2">Pour supprimer un document, vous devez intervenir directement au niveau du serveur :</p>
<ol class="list-decimal list-inside space-y-1 mb-4">
<li>Supprimer l'entrée dans la base de données (Django/SQLite)</li>
<li>Supprimer le fichier physique dans le bucket MinIO</li>
<li>Vider les chunks associés dans l'index Elasticsearch</li>
</ol>

<InfoBox type="warning" title="Attention">
Cette action est irréversible et contourne les logs d'audit de l'application. À utiliser uniquement pour des raisons légales ou techniques impératives.
</InfoBox>
`
      }
    ]
  }
]

// ============================================================================
// DONNÉES - ONGLET COMPRENDRE
// ============================================================================

const comprendreData = [
  {
    id: "pipeline",
    icon: Settings,
    title: "Pipeline de traitement",
    description: "Traitement automatique des documents",
    content: `
<p class="mb-4">Lors du dépôt, votre document passe par 5 étapes automatiques (2 à 10 secondes) :</p>

<div class="space-y-3 my-4">
<div class="flex items-start gap-3 p-3 bg-muted rounded-lg">
<div class="text-lg font-bold text-primary">1</div>
<div>
<strong>Vérification du type réel</strong>
<p class="text-sm text-muted-foreground mt-1">Vérifie que le fichier correspond à son extension.</p>
</div>
</div>

<div class="flex items-start gap-3 p-3 bg-muted rounded-lg">
<div class="text-lg font-bold text-primary">2</div>
<div>
<strong>Scan antivirus</strong>
<p class="text-sm text-muted-foreground mt-1">Détecte virus et codes malveillants.</p>
</div>
</div>

<div class="flex items-start gap-3 p-3 bg-muted rounded-lg">
<div class="text-lg font-bold text-primary">3</div>
<div>
<strong>Extraction des métadonnées</strong>
<p class="text-sm text-muted-foreground mt-1">Pages (PDF), dimensions (images), durée (vidéos), texte (OCR).</p>
</div>
</div>

<div class="flex items-start gap-3 p-3 bg-muted rounded-lg">
<div class="text-lg font-bold text-primary">4</div>
<div>
<strong>Création de la miniature</strong>
<p class="text-sm text-muted-foreground mt-1">Image de la première page pour l'affichage.</p>
</div>
</div>

<div class="flex items-start gap-3 p-3 bg-muted rounded-lg">
<div class="text-lg font-bold text-primary">5</div>
<div>
<strong>Préparation pour l'Assistant IA</strong>
<p class="text-sm text-muted-foreground mt-1">Texte découpé et analysé pour l'IA.</p>
</div>
</div>
</div>

<InfoBox type="success" title="Résultat">
Si toutes les étapes réussissent, le document est validé. Sinon, il est rejeté avec explication.
</InfoBox>
`
  },
  {
    id: "permissions",
    icon: Lock,
    title: "Permissions",
    description: "Contrôle d'accès aux documents",
    content: `
<h3 class="text-base font-semibold mb-3">Règles de base</h3>

<p class="mb-2"><strong>1. Département</strong></p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Par défaut : documents de votre département</li>
<li>Admin peut ajouter d'autres départements</li>
</ul>

<p class="mb-2"><strong>2. Documents confidentiels</strong></p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Visibles uniquement par : déposant, utilisateurs autorisés, admins</li>
</ul>

<p class="mb-2"><strong>3. Partages spécifiques</strong></p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Accès donné à des personnes précises</li>
</ul>

<h3 class="text-base font-semibold mb-3 mt-6">Exemple</h3>
<div class="bg-muted p-4 rounded-lg my-4">
<p class="mb-2 text-sm"><strong>Scénario :</strong></p>
<ul class="list-disc list-inside space-y-1 text-sm mb-3">
<li>Vous : département Finance</li>
<li>Vous déposez un rapport confidentiel</li>
<li>Vous autorisez Jean (RH) et Marie (Direction)</li>
</ul>

<p class="mb-2 text-sm"><strong>Résultat :</strong></p>
<ul class="list-disc list-inside space-y-1 text-sm">
<li>Vous, Jean, Marie, admins : voient le document</li>
<li>Autres membres Finance, RH : ne voient PAS</li>
</ul>
</div>

<InfoBox type="info" title="Assistant IA">
Respecte les mêmes règles. Ne répond pas sur les documents invisibles.
</InfoBox>
`
  },
  {
    id: "ia-fonctionnement",
    icon: Bot,
    title: "Fonctionnement de l'IA",
    description: "Comment l'IA répond à vos questions",
    content: `
<p class="mb-4">L'Assistant IA utilise le RAG (Retrieval-Augmented Generation). Fonctionnement simplifié :</p>

<h3 class="text-base font-semibold mb-3">Étape 1 : Analyse de la question</h3>
<p class="mb-4">Votre question est transformée en empreinte numérique représentant son sens.</p>

<h3 class="text-base font-semibold mb-3">Étape 2 : Recherche</h3>
<p class="mb-4">Le système cherche dans vos documents les passages les plus pertinents.</p>

<div class="bg-muted p-4 rounded-lg my-4">
<p class="text-sm"><strong>Exemple :</strong></p>
<p class="text-sm mt-2">Question : "Procédure de congés ?"</p>
<p class="text-sm mt-1">→ 5 passages trouvés parlant de congés, procédures, demandes.</p>
</div>

<h3 class="text-base font-semibold mb-3">Étape 3 : Génération</h3>
<p class="mb-4">L'IA lit ces passages et génère une réponse avec sources citées.</p>

<InfoBox type="success" title="Fiabilité">
Contrairement à ChatGPT, l'IA répond uniquement à partir de vos documents. Si l'information n'existe pas, elle vous le dit.
</InfoBox>

<h3 class="text-base font-semibold mb-3 mt-6">Sources</h3>
<p class="mb-2">Chaque réponse affiche :</p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Titre du document</li>
<li>Extrait précis</li>
<li>Lien vers l'original</li>
</ul>

<h3 class="text-base font-semibold mb-3">Limites</h3>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Ne comprend pas le contexte implicite</li>
<li>Prend les choses au sens littéral</li>
<li>Ne raisonne pas comme un humain</li>
</ul>

<InfoBox type="tip" title="Conseil">
Posez des questions précises et factuelles pour de meilleures réponses.
</InfoBox>
`
  },
  {
    id: "notifications-concept",
    icon: Bell,
    title: "Notifications",
    description: "Alertes in-app",
    content: `
<p class="mb-4">Les notifications vous informent des événements importants sans email.</p>

<h3 class="text-base font-semibold mb-3">Déclencheurs</h3>
<ul class="list-disc list-inside space-y-1 mb-4">
<li><strong>Validation</strong> : document déposé validé</li>
<li><strong>Rejet</strong> : document rejeté avec motif</li>
<li><strong>Accès accordé</strong> : accès à un document confidentiel</li>
<li><strong>Partage</strong> : document partagé avec vous</li>
</ul>

<h3 class="text-base font-semibold mb-3">Gestion</h3>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Icône en haut à droite</li>
<li>Non lues en surbrillance</li>
<li>Compteur de non lues</li>
<li>Marquage auto au clic</li>
</ul>

<InfoBox type="info" title="In-app uniquement">
Pas d'envoi par email pour éviter la surcharge.
</InfoBox>
`
  }
]

// ============================================================================
// DONNÉES - ONGLET ADMIN
// ============================================================================

const adminData = [
  {
    id: "utilisateurs",
    title: "Gestion des utilisateurs",
    items: [
      {
        question: "Ajouter un utilisateur",
        answer: `
<ol class="list-decimal list-inside space-y-1 mb-4">
<li>Admin → Utilisateurs → "Nouvel utilisateur"</li>
<li>Email professionnel (domaine autorisé)</li>
<li>Nom d'utilisateur et département</li>
<li>Mot de passe temporaire généré</li>
</ol>

<InfoBox type="info" title="Première connexion">
L'utilisateur doit changer son mot de passe immédiatement.
</InfoBox>
`
      },
      {
        question: "Accès multi-départements",
        answer: `
<ol class="list-decimal list-inside space-y-1 mb-4">
<li>Admin → Utilisateurs → [Utilisateur]</li>
<li>"Départements autorisés" → ajouter</li>
<li>Sauvegarder</li>
</ol>

<InfoBox type="tip" title="Cas d'usage">
Managers supervisant plusieurs départements, assistants de direction.
</InfoBox>
`
      },
      {
        question: "2FA obligatoire",
        answer: `
<p class="mb-2">2FA obligatoire si :</p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Utilisateur admin</li>
<li>Configuration globale</li>
<li>Activation individuelle</li>
</ul>

<p class="mb-2"><strong>Activer globalement :</strong></p>
<ol class="list-decimal list-inside space-y-1 mb-4">
<li>Admin → Configuration</li>
<li>"2FA obligatoire pour tous"</li>
<li>Sauvegarder</li>
</ol>

<InfoBox type="warning" title="Attention">
Communiquez avant d'activer. Peut bloquer les utilisateurs sans accès email hors bureau.
</InfoBox>
`
      }
    ]
  },
  {
    id: "maintenance-rag",
    title: "Maintenance de l'IA",
    items: [
      {
        question: "Réindexer les documents",
        answer: `
<p class="mb-2">Après modification ou problème d'indexation :</p>
<pre class="bg-slate-900 text-slate-100 p-3 rounded my-2 overflow-x-auto text-sm"><code>python manage.py indexer_rag</code></pre>

<p class="mb-2"><strong>Action :</strong></p>
<ul class="list-disc list-inside space-y-1 mb-4">
<li>Parcourt tous les documents validés</li>
<li>Découpe en morceaux de 800 mots</li>
<li>Génère les embeddings</li>
<li>Insère dans la base de recherche</li>
</ul>

<InfoBox type="warning" title="Durée">
Plusieurs minutes selon le volume. Ne pas interrompre.
</InfoBox>
`
      },
      {
        question: "Vérifier Elasticsearch",
        answer: `
<p class="mb-2"><strong>Méthode 1 : curl</strong></p>
<pre class="bg-slate-900 text-slate-100 p-3 rounded my-2 overflow-x-auto text-sm"><code>curl http://localhost:9200</code></pre>

<p class="mb-2"><strong>Méthode 2 : Logs</strong></p>
<pre class="bg-slate-900 text-slate-100 p-3 rounded my-2 overflow-x-auto text-sm"><code>wsl -d Ubuntu -u root journalctl -u elasticsearch -f</code></pre>

<p class="mb-2"><strong>Méthode 3 : Application</strong></p>
<p>Erreurs 500 sur l'IA = Elasticsearch arrêté.</p>

<InfoBox type="tip" title="Démarrer">
<pre class="bg-slate-900 text-slate-100 p-3 rounded my-2 overflow-x-auto text-sm"><code>wsl -d Ubuntu -u root systemctl start elasticsearch</code></pre>
</InfoBox>
`
      },
      {
        question: "Vider et recréer l'index",
        answer: `
<p class="mb-2"><strong>Étape 1 : Supprimer</strong></p>
<pre class="bg-slate-900 text-slate-100 p-3 rounded my-2 overflow-x-auto text-sm"><code>curl -X DELETE http://localhost:9200/sae_chunks</code></pre>

<p class="mb-2"><strong>Étape 2 : Réindexer</strong></p>
<pre class="bg-slate-900 text-slate-100 p-3 rounded my-2 overflow-x-auto text-sm"><code>python manage.py indexer_rag</code></pre>

<InfoBox type="warning" title="Attention">
Supprime toutes les données d'indexation. Documents physiques intacts. IA indisponible pendant la réindexation.
</InfoBox>
`
      }
    ]
  },
  {
    id: "glossaire",
    title: "Glossaire technique",
    items: [
      {
        question: "RAG",
        answer: `<p>Retrieval-Augmented Generation. L'IA répond en se basant sur vos documents, pas sur ses connaissances générales.</p>`
      },
      {
        question: "Chunk",
        answer: `<p>Extrait de texte d'environ 800 mots utilisé par l'IA pour analyser et citer précisément.</p>`
      },
      {
        question: "Embedding",
        answer: `<p>Représentation mathématique du sens d'un texte pour comparaison rapide.</p>`
      },
      {
        question: "ETL",
        answer: `<p>Extract-Transform-Load. Pipeline de traitement automatique des documents.</p>`
      },
      {
        question: "MIME",
        answer: `<p>Type réel d'un fichier (ex: application/pdf). Détecté par analyse du contenu, plus fiable que l'extension.</p>`
      },
      {
        question: "OCR",
        answer: `<p>Reconnaissance Optique de Caractères. Transforme image de texte en texte modifiable.</p>`
      },
      {
        question: "Row-level security",
        answer: `<p>Sécurité au niveau des lignes. Filtre les données selon les droits de l'utilisateur.</p>`
      }
    ]
  }
]

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState("")
  const { utilisateur } = useAuth()
  const isAdmin = utilisateur?.est_admin || false

  const filteredFaq = useMemo(() => {
    if (!searchQuery.trim()) return faqData
    const query = searchQuery.toLowerCase()
    return faqData
      .map(section => ({
        ...section,
        items: section.items.filter(
          item => item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query)
        )
      }))
      .filter(section => section.items.length > 0)
  }, [searchQuery])

  const filteredGuides = useMemo(() => {
    if (!searchQuery.trim()) return guidesData
    const query = searchQuery.toLowerCase()
    return guidesData.filter(
      guide => guide.title.toLowerCase().includes(query) || guide.description.toLowerCase().includes(query) || guide.content.toLowerCase().includes(query)
    )
  }, [searchQuery])

  const filteredComprendre = useMemo(() => {
    if (!searchQuery.trim()) return comprendreData
    const query = searchQuery.toLowerCase()
    return comprendreData.filter(
      item => item.title.toLowerCase().includes(query) || item.description.toLowerCase().includes(query) || item.content.toLowerCase().includes(query)
    )
  }, [searchQuery])

  const filteredAdmin = useMemo(() => {
    if (!searchQuery.trim()) return adminData
    const query = searchQuery.toLowerCase()
    return adminData
      .map(section => ({
        ...section,
        items: section.items.filter(
          item => item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query)
        )
      }))
      .filter(section => section.items.length > 0)
  }, [searchQuery])

  return (
    <div className="container mx-auto py-8 max-w-5xl px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Centre d'aide</h1>
        <p className="text-muted-foreground">
          Documentation complète du Système d'Archivage Électronique.
        </p>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Rechercher..."
          className="pl-10 h-12"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Tabs defaultValue="guides" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="guides">
            <BookOpen className="h-4 w-4 mr-2" />
            Guides
          </TabsTrigger>
          <TabsTrigger value="faq">
            <HelpCircle className="h-4 w-4 mr-2" />
            FAQ
          </TabsTrigger>
          <TabsTrigger value="comprendre">
            <Lightbulb className="h-4 w-4 mr-2" />
            Comprendre
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="admin">
              <Shield className="h-4 w-4 mr-2" />
              Admin
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="guides" className="space-y-6">
          {filteredGuides.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun résultat</CardContent></Card>
          ) : (
            <div className="grid gap-6">
              {filteredGuides.map((guide) => {
                const Icon = guide.icon
                return (
                  <Card key={guide.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{guide.title}</CardTitle>
                            <CardDescription className="mt-1">{guide.description}</CardDescription>
                          </div>
                        </div>
                        <LevelBadge level={guide.level} />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: guide.content.replace(/<InfoBox([^>]*)>([\s\S]*?)<\/InfoBox>/g, (match, attrs, content) => {
                          const typeMatch = attrs.match(/type="(\w+)"/)
                          const titleMatch = attrs.match(/title="([^"]+)"/)
                          const type = typeMatch ? typeMatch[1] : "info"
                          const title = titleMatch ? titleMatch[1] : ""
                          return `<div class="border-l-4 rounded-r-lg p-4 my-4 ${
                            type === "warning" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" :
                            type === "success" ? "border-green-500 bg-green-50 dark:bg-green-950/20" :
                            type === "tip" ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20" :
                            "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                          }"><div class="flex gap-3 items-start"><div class="flex-1">${title ? `<p class="font-semibold mb-1 text-sm">${title}</p>` : ''}<div class="text-sm">${content}</div></div></div></div>`
                        }).replace(/<StepCard number={(\d+)} title="([^"]+)">([\s\S]*?)<\/StepCard>/g, (match, num, title, content) => {
                          return `<div class="flex gap-4 mb-6"><div class="flex flex-col items-center"><div class="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">${num}</div><div class="w-0.5 flex-1 bg-border mt-2"></div></div><div class="flex-1 pb-2"><h4 class="font-semibold mb-2 text-sm">${title}</h4><div class="text-sm text-muted-foreground leading-relaxed">${content}</div></div></div>`
                        }) }} />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
<TabsContent value="faq" className="space-y-6">
  {filteredFaq.length === 0 ? (
    <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun résultat</CardContent></Card>
  ) : (
    filteredFaq.map((section) => (
      <Card key={section.id}>
        <CardHeader>
          <CardTitle className="text-xl">{section.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {section.items.map((item, index) => (
              <AccordionItem key={index} value={`${section.id}-${index}`}>
                <AccordionTrigger className="text-left text-base font-semibold">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="prose dark:prose-invert max-w-none text-base">
                    <div dangerouslySetInnerHTML={{ __html: item.answer.replace(/<InfoBox([^>]*)>([\s\S]*?)<\/InfoBox>/g, (match, attrs, content) => {
                      const typeMatch = attrs.match(/type="(\w+)"/)
                      const titleMatch = attrs.match(/title="([^"]+)"/)
                      const type = typeMatch ? typeMatch[1] : "info"
                      const title = titleMatch ? titleMatch[1] : ""
                      return `<div class="border-l-4 rounded-r-lg p-4 my-4 ${
                        type === "warning" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" :
                        type === "success" ? "border-green-500 bg-green-50 dark:bg-green-950/20" :
                        type === "tip" ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20" :
                        "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                      }"><div class="flex gap-3 items-start"><div class="flex-1">${title ? `<p class="font-semibold mb-1 text-base">${title}</p>` : ''}<div class="text-base">${content}</div></div></div></div>`
                    }) }} />
                  </div>
                </AccordionContent>
              </AccordionItem>
                   ))}
          </Accordion>
        </CardContent>
      </Card>
    ))
  )}
</TabsContent>

        <TabsContent value="comprendre" className="space-y-6">
          {filteredComprendre.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun résultat</CardContent></Card>
          ) : (
            <div className="grid gap-6">
              {filteredComprendre.map((item) => {
                const Icon = item.icon
                return (
                  <Card key={item.id}>
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{item.title}</CardTitle>
                          <CardDescription className="mt-1">{item.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <div dangerouslySetInnerHTML={{ __html: item.content.replace(/<InfoBox([^>]*)>([\s\S]*?)<\/InfoBox>/g, (match, attrs, content) => {
                          const typeMatch = attrs.match(/type="(\w+)"/)
                          const titleMatch = attrs.match(/title="([^"]+)"/)
                          const type = typeMatch ? typeMatch[1] : "info"
                          const title = titleMatch ? titleMatch[1] : ""
                          return `<div class="border-l-4 rounded-r-lg p-4 my-4 ${
                            type === "warning" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" :
                            type === "success" ? "border-green-500 bg-green-50 dark:bg-green-950/20" :
                            type === "tip" ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20" :
                            "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                          }"><div class="flex gap-3 items-start"><div class="flex-1">${title ? `<p class="font-semibold mb-1 text-sm">${title}</p>` : ''}<div class="text-sm">${content}</div></div></div></div>`
                        }) }} />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        {isAdmin && (
  <TabsContent value="admin" className="space-y-6">
    {filteredAdmin.length === 0 ? (
      <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun résultat</CardContent></Card>
    ) : (
      filteredAdmin.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle className="text-xl">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {section.items.map((item, index) => (
                <AccordionItem key={index} value={`${section.id}-${index}`}>
                  <AccordionTrigger className="text-left text-base font-semibold">
                    {item.question}
                  </AccordionTrigger>
                <AccordionContent>
                    <div className="prose dark:prose-invert max-w-none text-base">
                      <div dangerouslySetInnerHTML={{ __html: item.answer.replace(/<InfoBox([^>]*)>([\s\S]*?)<\/InfoBox>/g, (match, attrs, content) => {
                        const typeMatch = attrs.match(/type="(\w+)"/)
                        const titleMatch = attrs.match(/title="([^"]+)"/)
                        const type = typeMatch ? typeMatch[1] : "info"
                        const title = titleMatch ? titleMatch[1] : ""
                        return `<div class="border-l-4 rounded-r-lg p-4 my-4 ${
                          type === "warning" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" :
                          type === "success" ? "border-green-500 bg-green-50 dark:bg-green-950/20" :
                          type === "tip" ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20" :
                          "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                        }"><div class="flex gap-3 items-start"><div class="flex-1">${title ? `<p class="font-semibold mb-1 text-base">${title}</p>` : ''}<div class="text-base">${content}</div></div></div></div>`
                      }) }} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      ))
    )}
  </TabsContent>
)}
      </Tabs>

      <Card className="mt-8 bg-muted/50">
        <CardContent className="py-6 text-center">
          <p className="mb-4 text-muted-foreground">Information non trouvée ?</p>
          <Button variant="outline" onClick={() => window.location.href = "mailto:admin@sae.local"}>
            <Mail className="h-4 w-4 mr-2" />
            Contacter l'administrateur
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}