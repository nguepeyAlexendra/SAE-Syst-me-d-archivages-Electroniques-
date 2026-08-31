import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from '../i18n/useTranslation';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Mail, MessageCircle, Copy, Check } from 'lucide-react';

interface DocumentType {
  id: number;
  titre: string;
}

interface PartagerModalProps {
  document: DocumentType;
  onClose: () => void;
}

export default function PartagerModal({ document, onClose }: PartagerModalProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  const lienDocument = `${window.location.origin}/documents/${document.id}`;

  const handleEmailShare = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg('');

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `http://127.0.0.1:8000/api/documents/${document.id}/partager/`, 
        { email, message },
        { headers: { Authorization: `Token ${token}` } }
      );
      
      setStatusMsg('✅ ' + t.admin.permissions_ajouter_acces);
      setEmail('');
      setMessage('');
      
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (error: any) {
      setStatusMsg('❌ ' + t.commun.erreur + ' : ' + (error.response?.data?.erreur || t.commun.erreur));
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppShare = () => {
    const texte = `${t.documents.partager_whatsapp}: "${document.titre}"\n${lienDocument}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, '_blank');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(lienDocument);
    setCopied(true);
    setStatusMsg('📋 ' + t.commun.copier + ' !');
    setTimeout(() => {
      setCopied(false);
      setStatusMsg('');
    }, 2000);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{t.documents.partager}</DialogTitle>
          <DialogDescription className="truncate">
            {document.titre}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleEmailShare} className="space-y-4 mt-2">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium leading-none">
              {t.documents.partager_email}
            </label>
            <Input
              id="email"
              type="email"
              placeholder={t.auth.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="message" className="text-sm font-medium leading-none">
              {t.documents.tags}
            </label>
            <textarea
              id="message"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={t.commun.charger}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* ✅ VERSION SÉCURISÉE : Aucun changement d'icône, juste du texte */}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t.depot.envoi_en_cours : t.documents.partager_email}
          </Button>
        </form>

        {/* ✅ Message de statut intégré et sûr */}
        {statusMsg && (
          <div className={`p-3 rounded-md text-sm text-center font-medium ${
            statusMsg.includes('✅') || statusMsg.includes('📋') 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {statusMsg}
          </div>
        )}

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-muted"></div>
          <span className="flex-shrink-0 mx-4 text-muted-foreground text-xs uppercase font-medium">
            {t.documents.partager}
          </span>
          <div className="flex-grow border-t border-muted"></div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={handleWhatsAppShare} disabled={loading} className="flex items-center justify-center gap-2 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200">
            <MessageCircle className="h-4 w-4" /> {t.documents.partager_whatsapp}
          </Button>
          <Button variant="outline" onClick={handleCopyLink} disabled={loading} className="flex items-center justify-center gap-2">
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            {copied ? t.commun.confirmer : t.commun.copier}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}