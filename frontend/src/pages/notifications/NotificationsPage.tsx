import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import apiClient from "@/api/client"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { 
  Bell, Check, CheckCheck, Trash2, FileText, XCircle, UserPlus, Share2
} from "lucide-react"
import TableFooter from "@/components/TableFooter"

interface Notification {
  id: number
  titre: string
  message: string
  type: 'validation' | 'rejet' | 'partage' | 'acces_accorde' | 'nouveau_document'
  // On accepte les deux formats possibles venant du backend
  document?: { id: number; titre: string } | null
  document_titre?: string
  document_id?: number
  lue: boolean
  date_creation: string
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState("all")
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [totalCount, setTotalCount] = useState(0)

  const fetchNotifications = async (page: number, filter: string, keepOld = false) => {
    if (!keepOld) setLoading(true)
    try {
      const params: any = { page, limit: rowsPerPage }
      if (filter === 'non_lues') {
        params.non_lues = 'true'
      } else if (filter !== 'all') {
        params.type = filter
      }
      
      const response = await apiClient.get<any>('/notifications/', { params })
      const data = response.data
      
      const liste = Array.isArray(data) ? data : (data.results || [])
      const total = Array.isArray(data) ? data.length : (data.count || 0)
      
      setNotifications(liste)
      setTotalCount(total)
    } catch (error) {
      console.error("Erreur chargement notifications", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications(currentPage, filterType)
  }, [currentPage, filterType, rowsPerPage])

  const handleMarkAsRead = async (id: number) => {
    try {
      await apiClient.post(`/notifications/${id}/marquer_lue/`)
      fetchNotifications(currentPage, filterType, true)
    } catch (error) { console.error(error) }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await apiClient.post('/notifications/tout_marquer_comme_lu/')
      fetchNotifications(currentPage, filterType, true)
    } catch (error) { console.error(error) }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm("Supprimer cette notification ?")) return
    try {
      await apiClient.delete(`/notifications/${id}/`)
      fetchNotifications(currentPage, filterType, true)
    } catch (error) { console.error(error) }
  }

  const handleBulkDelete = async () => {
    if (!window.confirm(`Supprimer ${selectedIds.length} notification(s) ?`)) return
    try {
      await Promise.all(selectedIds.map(id => apiClient.delete(`/notifications/${id}/`)))
      setSelectedIds([])
      fetchNotifications(currentPage, filterType, true)
    } catch (error) { console.error(error) }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === notifications.length && notifications.length > 0) {
      setSelectedIds([])
    } else {
      setSelectedIds(notifications.map(n => n.id))
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const getTypeIcon = (type: string) => {
    const props = { className: "h-4 w-4 shrink-0" }
    switch (type) {
      case 'validation': return <Check {...props} className={`${props.className} text-green-600`} />
      case 'rejet': return <XCircle {...props} className={`${props.className} text-red-600`} />
      case 'partage': return <Share2 {...props} className={`${props.className} text-blue-600`} />
      case 'acces_accorde': return <UserPlus {...props} className={`${props.className} text-purple-600`} />
      case 'nouveau_document': return <FileText {...props} className={`${props.className} text-amber-600`} />
      default: return <Bell {...props} className={`${props.className} text-gray-500`} />
    }
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      validation: 'Validation', rejet: 'Rejet', partage: 'Partage',
      acces_accorde: 'Accès accordé', nouveau_document: 'Nouveau document'
    }
    return labels[type] || type
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const totalPages = Math.ceil(totalCount / rowsPerPage)

  const handleFilterChange = (newFilter: string) => {
    setFilterType(newFilter)
    setCurrentPage(1)
    setSelectedIds([])
    fetchNotifications(1, newFilter, true)
  }

  if (loading && notifications.length === 0) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            {totalCount} notification{totalCount > 1 ? 's' : ''} au total
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer ({selectedIds.length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Tout marquer comme lu
          </Button>
        </div>
      </div>

      <Tabs value={filterType} onValueChange={handleFilterChange}>
        <TabsList>
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="non_lues">Non lues</TabsTrigger>
          <TabsTrigger value="validation">Validations</TabsTrigger>
          <TabsTrigger value="rejet">Rejets</TabsTrigger>
          <TabsTrigger value="partage">Partages</TabsTrigger>
          <TabsTrigger value="nouveau_document">Nouveaux documents</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={notifications.length > 0 && selectedIds.length === notifications.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-12">État</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead className="max-w-md">Message</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    Aucune notification trouvée.
                  </TableCell>
                </TableRow>
              ) : (
                notifications.map((notification) => (
                  <TableRow 
                    key={notification.id}
                    className={`${!notification.lue ? 'bg-primary/5' : ''} hover:bg-muted/50 transition-colors`}
                  >
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.includes(notification.id)}
                        onCheckedChange={() => toggleSelect(notification.id)}
                      />
                    </TableCell>
                    <TableCell>
                      {notification.lue ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(notification.type)}
                        <span className="text-sm">{getTypeLabel(notification.type)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{notification.titre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-md">
                      {notification.message}
                    </TableCell>
                    <TableCell>
                      {/* ✅ BLINDÉ : Affiche le document qu'il soit en objet ou en champs séparés */}
                      {(notification.document?.titre || notification.document_titre) ? (
                        <Badge 
                          variant="outline" 
                          className="cursor-pointer hover:bg-accent" 
                          onClick={() => navigate(`/documents/${notification.document?.id || notification.document_id}`)}
                        >
                          {notification.document?.titre || notification.document_titre}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(notification.date_creation)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!notification.lue && (
                          <Button variant="ghost" size="icon" onClick={() => handleMarkAsRead(notification.id)} title="Marquer comme lu">
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(notification.id)} title="Supprimer">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* ✅ PIED DE PAGE UNIFORME */}
          {totalCount > 0 && (
            <TableFooter
              currentPage={currentPage}
              totalPages={totalPages}
              rowsPerPage={rowsPerPage}
              totalRows={totalCount}
              onPageChange={setCurrentPage}
              onRowsPerPageChange={(rows) => { setRowsPerPage(rows); setCurrentPage(1); }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}