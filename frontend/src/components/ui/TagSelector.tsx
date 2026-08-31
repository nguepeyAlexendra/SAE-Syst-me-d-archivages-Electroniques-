import { useState, KeyboardEvent } from 'react';
import { Badge } from './badge';
import { Input } from './input';
import { X } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

interface TagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export default function TagSelector({ selectedTags, onTagsChange }: TagSelectorProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');

  const addTag = (tag: string) => {
    const cleanTag = tag.trim();
    console.log("🏷️ Tentative d'ajout du tag :", cleanTag);
    
    if (cleanTag && !selectedTags.includes(cleanTag)) {
      console.log("✅ Tag ajouté avec succès au tableau !");
      onTagsChange([...selectedTags, cleanTag]);
    } else {
      console.log("❌ Tag ignoré (vide ou déjà présent)");
    }
    setInputValue('');
  };

  const removeTag = (tagToRemove: string) => {
    console.log("🗑️ Tag supprimé :", tagToRemove);
    onTagsChange(selectedTags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault(); // Empêche le formulaire de se soumettre prématurément
      console.log("⌨️ Touche Entrée ou Virgule détectée");
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      console.log("⌨️ Touche Retour arrière détectée (suppression du dernier tag)");
      removeTag(selectedTags[selectedTags.length - 1]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-background focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-0 transition-all">
        {selectedTags.map((tag) => (
          <Badge 
            key={tag} 
            variant="secondary" 
            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-1 hover:text-destructive focus:outline-none rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length === 0 ? `${t.documents.choisir_tag}...` : ""}
          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 min-w-[120px] p-0 h-6 text-sm bg-transparent shadow-none"
        />
      </div>
      
      <p className="text-[11px] text-muted-foreground">
        {t.documents.tags_aide}
      </p>
    </div>
  );
}