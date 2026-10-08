import { Download, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminTableToolbar({ term, onSearch, status, onStatus, onExport, onRefresh, refreshing = false }: {
  term: string; onSearch: (value: string) => void; status?: string; onStatus?: (value: string) => void;
  onExport: () => void; onRefresh: () => void; refreshing?: boolean;
}) {
  return <div className="ml-auto flex flex-wrap items-center justify-end gap-2" role="toolbar" aria-label="Table controls">
    <label className="relative"><Search className="pointer-events-none absolute left-2.5 top-3 size-4 text-muted-foreground" />
      <input aria-label="Search table" placeholder="Search records" value={term} onChange={(e) => onSearch(e.target.value)} className="h-10 w-44 rounded-md border border-input bg-background pl-9 pr-2 text-xs" />
    </label>
    {onStatus && <select aria-label="Status filter" value={status} onChange={(e) => onStatus(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-xs">
      {['all', 'pending', 'approved', 'rejected'].map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
    </select>}
    <Button variant="outline" size="sm" onClick={onExport}><Download />Export CSV</Button>
    <Button variant="outline" size="icon" aria-label="Refresh table" title="Refresh" disabled={refreshing} onClick={onRefresh}><RefreshCw className={refreshing ? "animate-spin" : ""} /></Button>
  </div>;
}