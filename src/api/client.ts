import * as vscode from 'vscode';

export interface TableMetadata {
    name: string;
    fullyQualifiedName: string;
    id: string;
    description: string;
    owner: string;
    tier: string;
    tags: string[];
    columns: { name: string; dataType: string; description: string }[];
    dqScore: number | null;
    tableUrl: string;
}

export class OpenMetadataClient {
    private baseUrl: string;
    private token: string;

    constructor() {
        const config = vscode.workspace.getConfiguration('openmetadata');

        this.baseUrl =
            config.get<string>('serverUrl') ||
            'https://sandbox.open-metadata.org';

        this.token =
            config.get<string>('token') ||
            '';
        console.log(
        'Token being used:',
        this.token
            ? 'YES (length: ' + this.token.length + ')'
            : 'NO TOKEN'
    );

    }
    private async fetchWithTimeout(url: string, headers: Record<string, string>): Promise<Response> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
            return await fetch(url, { headers, signal: controller.signal });
        } finally {
            clearTimeout(timer);
        }
    }

    async getTable(tableName: string): Promise<TableMetadata | null> {
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (this.token.trim()) { headers['Authorization'] = `Bearer ${this.token}`; }

            const hasDots = tableName.includes('.');

            // Only do direct FQN lookup if word has dots (e.g. db.schema.table)
            if (hasDots) {
                const directUrl = `${this.baseUrl}/api/v1/tables/name/${encodeURIComponent(tableName)}?fields=tags,columns,owners`;
                const directRes = await this.fetchWithTimeout(directUrl, headers);
                if (directRes.ok) {
                    return this.parseTableData(await directRes.json() as any, tableName);
                }
            }

            // Plain word (e.g. "users") — go straight to search
            const searchUrl = `${this.baseUrl}/api/v1/search/query?q=${encodeURIComponent(tableName)}&index=table_search_index&limit=5`;
            const searchRes = await this.fetchWithTimeout(searchUrl, headers);
            if (!searchRes.ok) { return null; }

            const hits: any[] = (await searchRes.json() as any).hits?.hits || [];
            console.log(`Search hits for "${tableName}":`, hits.map((h: any) => h._source?.name));
            const match = hits.find((h: any) => h._source?.name?.toLowerCase() === tableName.toLowerCase());
            if (!match) {
                console.log(`No exact match found for "${tableName}"`);
                return null;
            }

            const fqn = match._source?.fullyQualifiedName;
            if (!fqn) { return null; }

            // search results lack full column data — fetch by FQN
            const fqnUrl = `${this.baseUrl}/api/v1/tables/name/${encodeURIComponent(fqn)}?fields=tags,columns,owners`;
            const fqnRes = await this.fetchWithTimeout(fqnUrl, headers);
            if (!fqnRes.ok) { return null; }

            return this.parseTableData(await fqnRes.json() as any, tableName);

        } catch (error: any) {
            if (error?.name !== 'AbortError') { console.error('getTable error:', error); }
            return null;
        }
    }

    private parseTableData(data: any, fallbackName: string): TableMetadata {
        const tierTag = data.tags?.find((t: any) => t.tagFQN?.startsWith('Tier.'))?.tagFQN || '';
        return {
            name: data.name || fallbackName,
            fullyQualifiedName: data.fullyQualifiedName || fallbackName,
            id: data.id || '',
            description: data.description || 'No description',
            owner: data.owners?.[0]?.displayName || data.owners?.[0]?.name || 'Unknown',
            tier: tierTag.replace('Tier.', '') || 'Not set',
            tags: data.tags?.filter((t: any) => !t.tagFQN?.startsWith('Tier.')).map((t: any) => t.tagFQN) || [],
            columns: data.columns?.slice(0, 5).map((c: any) => ({
                name: c.name,
                dataType: c.dataType || 'unknown',
                description: c.description || ''
            })) || [],
            dqScore: null,
            tableUrl: `${this.baseUrl}/table/${data.fullyQualifiedName}`
        };
    }

    

    async searchTables(query: string): Promise<any[]> {
        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            if (this.token.trim()) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }

            const url =
                `${this.baseUrl}/api/v1/search/query` +
                `?q=${encodeURIComponent(query)}` +
                `&index=table_search_index&limit=10`;

            console.log('Searching tables:', url);

            const response = await fetch(url, { headers });

            console.log('Search status:', response.status);

            if (!response.ok) {
                return [];
            }

            const data = await response.json() as any;

            return data.hits?.hits || [];

        } catch (error) {
            console.error(
                'OpenMetadata search error:',
                error
            );
            return [];
        }
    }
    async getLineage(fqn: string): Promise<any | null> {
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (this.token.trim()) { headers['Authorization'] = `Bearer ${this.token}`; }

            // depth=1 only — depth=2 is much slower
            const url = `${this.baseUrl}/api/v1/lineage/getLineage?fqn=${encodeURIComponent(fqn)}&type=table&upstreamDepth=1&downstreamDepth=1`;
            console.log('Fetching lineage:', url);

            const response = await this.fetchWithTimeout(url, headers);
            if (!response.ok) { return null; }
            return await response.json();
        } catch (error: any) {
            if (error?.name !== 'AbortError') { console.error('Lineage error:', error); }
            return null;
        }
    }

    async getDataQuality(fqn: string): Promise<any[]> {
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (this.token.trim()) { headers['Authorization'] = `Bearer ${this.token}`; }

            const url = `${this.baseUrl}/api/v1/dataQuality/testCases?entityLink=${encodeURIComponent(`<#E::table::${fqn}>`)}&limit=5&latest=true`;
            console.log('Fetching DQ:', url);

            const response = await this.fetchWithTimeout(url, headers);
            if (!response.ok) { return []; }
            const data = await response.json() as any;
            return data.data || [];
        } catch (error: any) {
            if (error?.name !== 'AbortError') { console.error('DQ error:', error); }
            return [];
        }
    }
}