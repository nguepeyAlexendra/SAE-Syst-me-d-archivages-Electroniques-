import { Button } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { useTranslation } from '../../i18n/useTranslation';

interface TableFooterProps {
  currentPage: number;
  totalPages: number;
  rowsPerPage: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rows: number) => void;
}

export default function TableFooter({
  currentPage,
  totalPages,
  rowsPerPage,
  totalRows,
  onPageChange,
  onRowsPerPageChange,
}: TableFooterProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-background">
      {/* Partie GAUCHE : Indicateur de page */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {t.commun.page} {currentPage} {t.commun.sur} {totalPages}
        </span>
      </div>

      {/* Partie DROITE : Sélecteur + Navigation */}
      <div className="flex items-center gap-4">
        {/* Sélecteur de lignes */}
        <div className="flex items-center gap-2">
          <Select
            value={rowsPerPage.toString()}
            onValueChange={(value) => onRowsPerPageChange(Number(value))}
          >
            <SelectTrigger className="w-16 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{t.commun.lignes_par_page}</span>
        </div>

        {/* Boutons de navigation - TOUJOURS VISIBLES */}
        <div className="flex items-center gap-1">
          {/* Première page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
          >
            {'<<'}
          </Button>
          
          {/* Page précédente */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0"
          >
            {'<'}
          </Button>
          
          {/* Numéros de page - TOUJOURS AFFICHÉS */}
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={currentPage === page ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page)}
              className="h-8 w-8 p-0"
            >
              {page}
            </Button>
          ))}
          
          {/* Page suivante */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0"
          >
            {'>'}
          </Button>
          
          {/* Dernière page */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0"
          >
            {'>>'}
          </Button>
        </div>
      </div>
    </div>
  );
}