import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tag, X } from 'lucide-react';
import { type TagType } from '../api/documents';
import { useTranslation } from '../i18n/useTranslation';

interface TagFilterPopoverProps {
  tagsDisponibles: TagType[];
  tagFiltre: string;
  onTagChange: (tag: string) => void;
  label?: string;
  size?: 'sm' | 'default';
}

export default function TagFilterPopover({
  tagsDisponibles,
  tagFiltre,
  onTagChange,
  label,
  size = 'sm',
}: TagFilterPopoverProps) {
  const { t } = useTranslation();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [rechercheTag, setRechercheTag] = useState('');

  const tagsFiltres = tagsDisponibles.filter((tag) =>
    tag.nom.toLowerCase().includes(rechercheTag.toLowerCase())
  );

  return (
    <div className="relative">
      <Button
        variant={tagFiltre ? "default" : "outline"}
        size={size}
        className="gap-1.5 text-xs h-8"
        onClick={() => setMenuOuvert(!menuOuvert)}
      >
        <Tag className="h-3.5 w-3.5" />
        {tagFiltre || label || t.documents.tags}
      </Button>

      {menuOuvert && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOuvert(false)} />
          
          <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-md border bg-white dark:bg-gray-900 p-4 shadow-lg">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  {t.commun.rechercher}
                </p>
                <Input
                  type="text"
                  placeholder={t.documents.taper_tag}
                  value={rechercheTag}
                  onChange={(e) => setRechercheTag(e.target.value)}
                  className="h-9 text-sm"
                  autoFocus
                />
              </div>

              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                  {t.documents.choisir_tag}
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {tagsFiltres.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        onTagChange(tag.nom === tagFiltre ? '' : tag.nom);
                        setMenuOuvert(false);
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all text-gray-700 dark:text-gray-200 ${
                        tagFiltre === tag.nom
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold'
                          : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.couleur }} />
                      {tag.nom}
                    </button>
                  ))}
                  {tagsFiltres.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {tagsDisponibles.length === 0 ? t.documents.tag_dispo : t.commun.aucun_resultat}
                    </p>
                  )}
                </div>
              </div>

              {tagFiltre && (
                <button
                  onClick={() => {
                    onTagChange('');
                    setRechercheTag('');
                    setMenuOuvert(false);
                  }}
                  className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border-t pt-2 text-center"
                >
                  <X className="h-3 w-3 inline mr-1" />
                  {t.commun.effacer_filtre}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}