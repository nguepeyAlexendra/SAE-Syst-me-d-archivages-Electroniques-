import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from '../i18n/useTranslation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Plus, Trash2, Check, X, AlertCircle, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { getConfigurationConnexion, updateConfigurationConnexion } from '../api/auth';

interface Domaine {
  id: number;
  domaine: string;
  actif: boolean;
  date_ajout: string;
}

const API_BASE = 'http://127.0.0.1:8000/api/auth/domaines-email';
const API_BULK = 'http://127.0.0.1:8000/api/auth/domaines-email-bulk';

export default function GestionDomainesEmail() {
  const { t, langue } = useTranslation();
  const [domaines, setDomaines] = useState<Domaine[]>([]);
  const [nouveauDomaine, setNouveauDomaine] = useState('');
  const [chargement, setChargement] = useState(true);
  const [selectionnes, setSelectionnes] = useState<number[]>([]);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  
  // ✅ NOUVEAU : État pour le toggle 2FA admin
  const [twoFaObligatoire, setTwoFaObligatoire] = useState(false);
  const [chargementConfig, setChargementConfig] = useState(true);

  useEffect(() => {
    chargerDomaines();
    chargerConfiguration();
  }, []);

  // ✅ NOUVEAU : Charger la configuration globale
  async function chargerConfiguration() {
    try {
      const config = await getConfigurationConnexion();
      setTwoFaObligatoire(config.two_fa_obligatoire);
    } catch (error) {
      console.error('Erreur chargement config:', error);
    } finally {
      setChargementConfig(false);
    }
  }

  // ✅ NOUVEAU : Mettre à jour le toggle 2FA
  async function toggleTwoFaObligatoire(actif: boolean) {
    try {
      await updateConfigurationConnexion({ two_fa_obligatoire: actif });
      setTwoFaObligatoire(actif);
      toast.success(
        actif 
          ? t.admin.deux_fa_impose_toast
          : t.admin.deux_fa_retire_toast
      );
    } catch (error) {
      toast.error(t.commun.erreur);
    }
  }

  async function chargerDomaines() {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE}/`, {
        headers: { Authorization: `Token ${token}` }
      });
      setDomaines(response.data);
    } catch (error) {
      toast.error(t.commun.erreur);
    } finally {
      setChargement(false);
    }
  }

  async function ajouterDomaine(e: React.FormEvent) {
    e.preventDefault();
    if (!nouveauDomaine.trim()) return;

    if (!nouveauDomaine.includes('@')) {
      toast.error(t.admin.domaine_sans_at);
      return;
    }

    setAjoutEnCours(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE}/`,
        { domaine: nouveauDomaine.trim(), actif: true },
        { headers: { Authorization: `Token ${token}` } }
      );
      setDomaines([...domaines, response.data]);
      setNouveauDomaine('');
      toast.success(t.admin.domaine_ajoute_toast);
    } catch (error: any) {
      toast.error(error.response?.data?.domaine?.[0] || t.commun.erreur);
    } finally {
      setAjoutEnCours(false);
    }
  }

  async function toggleDomaine(id: number, actif: boolean) {
    try {
      const token = localStorage.getItem('token');
      await axios.patch(
        `${API_BASE}/${id}/`,
        { actif },
        { headers: { Authorization: `Token ${token}` } }
      );
      setDomaines(domaines.map(d => d.id === id ? { ...d, actif } : d));
      toast.success(actif ? t.admin.domaine_active_toast : t.admin.domaine_desactive_toast);
    } catch (error) {
      toast.error(t.commun.erreur);
    }
  }

  async function supprimerDomaine(id: number) {
    if (!window.confirm(t.admin.domaine_supprime_confirm)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_BASE}/${id}/`, {
        headers: { Authorization: `Token ${token}` }
      });
      setDomaines(domaines.filter(d => d.id !== id));
      setSelectionnes(selectionnes.filter(sid => sid !== id));
      toast.success(t.admin.domaine_supprime_toast);
    } catch (error) {
      toast.error(t.commun.erreur);
    }
  }

  async function actionMultiple(action: 'activer' | 'desactiver') {
    if (selectionnes.length === 0) {
      toast.error(t.admin.selectionnez_domaine_toast);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        API_BULK,
        { action, domaines: selectionnes },
        { headers: { Authorization: `Token ${token}` } }
      );
      setDomaines(domaines.map(d => 
        selectionnes.includes(d.id) ? { ...d, actif: action === 'activer' } : d
      ));
      setSelectionnes([]);
      toast.success(action === 'activer' ? t.admin.domaines_actives_toast : t.admin.domaines_desactivees_toast);
    } catch (error) {
      toast.error(t.commun.erreur);
    }
  }

  const toggleSelection = (id: number) => {
    setSelectionnes(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* ✅ NOUVEAU : Card Sécurité de connexion (2FA global) */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {t.admin.secu_connexion}
          </CardTitle>
          <CardDescription>
            {t.admin.secu_connexion_desc}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
            <div className="flex-1 pr-4">
              <Label htmlFor="two-fa-global" className="text-base font-semibold cursor-pointer">
                {t.admin.imposer_2fa_tous}
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {t.admin.imposer_2fa_desc_1} {t.admin.imposer_2fa_desc_2}
              </p>
            </div>
            {chargementConfig ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                id="two-fa-global"
                checked={twoFaObligatoire}
                onCheckedChange={toggleTwoFaObligatoire}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card existante : Gestion des domaines e-mail */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-4">
            <span>{t.admin.gestion_domaines_email}</span>
            {selectionnes.length > 0 && (
              <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => actionMultiple('activer')}>
                  <Check className="h-4 w-4 mr-1" /> {t.commun.activer} ({selectionnes.length})
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => actionMultiple('desactiver')}>
                  <X className="h-4 w-4 mr-1" /> {t.commun.desactiver} ({selectionnes.length})
                </Button>
              </div>
            )}
          </CardTitle>
          <CardDescription>
            {t.admin.domaines_desc}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={ajouterDomaine} className="flex gap-3 items-end bg-muted/30 p-4 rounded-lg border">
            <div className="flex-1 space-y-2">
              <Label htmlFor="domaine">{t.admin.ajouter_domaine}</Label>
              <Input
                id="domaine"
                placeholder={t.admin.domaine_placeholder}
                value={nouveauDomaine}
                onChange={(e) => setNouveauDomaine(e.target.value)}
                disabled={ajoutEnCours}
              />
            </div>
            <Button type="submit" disabled={ajoutEnCours || !nouveauDomaine.trim()}>
              {ajoutEnCours ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              {t.admin.departement_ajouter}
            </Button>
          </form>

          <div className="space-y-3">
            {chargement ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 mr-2 animate-spin" /> {t.commun.charger}
              </div>
            ) : domaines.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p>{t.admin.aucun_domaine}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {domaines.map((domaine) => (
                  <div
                    key={domaine.id}
                    className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                      selectionnes.includes(domaine.id) ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <input
                        type="checkbox"
                        checked={selectionnes.includes(domaine.id)}
                        onChange={() => toggleSelection(domaine.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer accent-primary"
                      />
                      <div>
                        <p className="font-semibold text-base">@{domaine.domaine}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.admin.ajoute_le} {new Date(domaine.date_ajout).toLocaleDateString(langue === 'en' ? 'en-US' : 'fr-FR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={domaine.actif ? 'default' : 'secondary'} className="px-3 py-1">
                        {domaine.actif ? t.admin.actif : t.admin.inactif}
                      </Badge>
                      <Switch
                        checked={domaine.actif}
                        onCheckedChange={(checked) => toggleDomaine(domaine.id, checked)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => supprimerDomaine(domaine.id)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title={t.documents.supprimer}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}