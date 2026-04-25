import { OpenMetadataClient, TableMetadata } from '../api/client';
import { MetadataCache } from '../cache/metadataCache';
import { parseAliases } from './aliasParser';

const SQL_KEYWORDS = /^(SELECT|FROM|WHERE|JOIN|ON|AND|OR|NOT|IN|IS|NULL|AS|BY|GROUP|ORDER|HAVING|LIMIT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INDEX|VIEW|WITH|CASE|WHEN|THEN|ELSE|END|DISTINCT|UNION|ALL|INTO|SET|VALUES|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|TRUE|FALSE|COUNT|SUM|AVG|MIN|MAX)$/i;

export type FetchState = 'not_found' | 'failed';

export class Prefetcher {
    private client: OpenMetadataClient;
    private cache: MetadataCache;
    private inFlight = new Map<string, Promise<any>>();
    private dead = new Map<string, FetchState>(); // words that won't resolve

    constructor(cache: MetadataCache) {
        this.client = new OpenMetadataClient();
        this.cache = cache;
    }

    prefetch(raw: string, documentText?: string): void {
        let resolved = raw;
        if (documentText) {
            const aliases = parseAliases(documentText);
            const dotIndex = raw.indexOf('.');
            if (dotIndex === -1) {
                resolved = aliases.get(raw) ?? raw;
            } else {
                const prefix = raw.substring(0, dotIndex);
                const aliasResolved = aliases.get(prefix);
                if (aliasResolved) {
                    resolved = `${aliasResolved}.${raw.substring(dotIndex + 1)}`;
                }
            }
        }

        for (const word of this.extractCandidates(resolved)) {
            if (word.length < 3 || SQL_KEYWORDS.test(word)) continue;
            if (this.dead.has(word)) continue;
            if (this.cache.getTable(word)) continue;
            if (this.inFlight.has(word)) continue;

            const p = this.client.getTable(word)
                .then(data => {
                    if (data) {
                        this.cache.setTable(word, data);
                        this.prefetchExtras(data.fullyQualifiedName);
                    } else {
                        this.dead.set(word, 'not_found');
                    }
                })
                .catch(() => {
                    this.dead.set(word, 'failed');
                })
                .finally(() => this.inFlight.delete(word));

            this.inFlight.set(word, p);
        }
    }

    private extractCandidates(raw: string): string[] {
        const parts = raw.split('.');
        const candidates: string[] = [];
        for (let i = parts.length; i >= 1; i--) {
            candidates.push(parts.slice(0, i).join('.'));
        }
        return candidates;
    }

    private prefetchExtras(fqn: string): void {
        const lKey = `lineage:${fqn}`;
        const dKey = `dq:${fqn}`;

        if (!this.cache.getLineage(fqn) && !this.inFlight.has(lKey)) {
            const p = this.client.getLineage(fqn)
                .then(data => { if (data) this.cache.setLineage(fqn, data); })
                .finally(() => this.inFlight.delete(lKey));
            this.inFlight.set(lKey, p);
        }

        if (!this.cache.getDQ(fqn) && !this.inFlight.has(dKey)) {
            const p = this.client.getDataQuality(fqn)
                .then(data => { this.cache.setDQ(fqn, data); })
                .finally(() => this.inFlight.delete(dKey));
            this.inFlight.set(dKey, p);
        }
    }

    getDeadState(word: string): FetchState | undefined {
        return this.dead.get(word);
    }

    getInFlight(word: string): Promise<any> | undefined {
        return this.inFlight.get(word);
    }
}
