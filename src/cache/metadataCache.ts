import { TableMetadata } from '../api/client';

const FRESH_MS  = 60_000;   // < 1 min → fresh
const STALE_MS  = 300_000;  // < 5 min → stale (serve + revalidate)

interface Entry<T> { data: T; fetchedAt: number; }
export type CacheStatus = 'fresh' | 'stale' | 'miss';

function getEntry<T>(store: Map<string, Entry<T>>, key: string): { data: T; status: CacheStatus } | null {
    const e = store.get(key);
    if (!e) return null;
    const age = Date.now() - e.fetchedAt;
    if (age < FRESH_MS)  return { data: e.data, status: 'fresh' };
    if (age < STALE_MS)  return { data: e.data, status: 'stale' };
    store.delete(key);
    return null;
}

export class MetadataCache {
    private tables   = new Map<string, Entry<TableMetadata>>();
    private lineage  = new Map<string, Entry<any>>();
    private dq       = new Map<string, Entry<any[]>>();

    getTable(key: string)   { return getEntry(this.tables,  key); }
    getLineage(key: string) { return getEntry(this.lineage, key); }
    getDQ(key: string)      { return getEntry(this.dq,      key); }

    setTable(key: string, data: TableMetadata) { this.tables.set(key,  { data, fetchedAt: Date.now() }); }
    setLineage(key: string, data: any)         { this.lineage.set(key, { data, fetchedAt: Date.now() }); }
    setDQ(key: string, data: any[])            { this.dq.set(key,      { data, fetchedAt: Date.now() }); }
}
