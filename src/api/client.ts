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
    async getTable(tableName: string): Promise<TableMetadata | null> {
    try {
        const encodedName = encodeURIComponent(tableName);

        const headers: Record<string, string> = {
            "Content-Type": "application/json"
        };

        if (this.token.trim()) {
            headers["Authorization"] = `Bearer ${this.token}`;
        }

        const url =
          `${this.baseUrl}/api/v1/tables/name/${encodedName}?fields=tags,columns,owners`;
        console.log("Fetching:", url);

        const response = await fetch(url, { headers });

        console.log("Status:", response.status);

        if (!response.ok) {
            const txt = await response.text();
            console.log("Error body:", txt);
            return null;
        }

        const data = await response.json() as any;

        const tierTag =
            data.tags?.find((t: any) =>
                t.tagFQN?.startsWith("Tier.")
            )?.tagFQN || "";

        return {
    name: data.name || tableName,
    fullyQualifiedName: data.fullyQualifiedName || tableName,
    id: data.id || '',
    description: data.description || 'No description',
    owner: data.owners?.[0]?.displayName || data.owners?.[0]?.name || data.owner?.displayName || data.owner?.name || 'Unknown',
    tier: tierTag.replace('Tier.', '') || 'Not set',
    tags: data.tags
        ?.filter((t: any) => !t.tagFQN?.startsWith('Tier.'))
        ?.map((t: any) => t.tagFQN) || [],
    columns: data.columns?.slice(0, 5).map((c: any) => ({
        name: c.name,
        dataType: c.dataType || 'unknown',
        description: c.description || ''
    })) || [],
    dqScore: null,
    tableUrl: `${this.baseUrl}/table/${data.fullyQualifiedName}`
};

    } catch (error) {
        console.error(error);
        return null;
    }
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
    async getLineage(tableId: string): Promise<any | null> {
    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (this.token.trim()) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        

        const tableFqn = encodeURIComponent(tableId);
        const url = `${this.baseUrl}/api/v1/lineage/getLineage?fqn=${encodeURIComponent(tableFqn)}&type=table&upstreamDepth=2&downstreamDepth=2`;
        console.log('Fetching lineage:', url);

        const response = await fetch(url, { headers });

if (!response.ok) {
    console.log('Lineage status:', response.status);
    const txt = await response.text();
    console.log('Lineage error body:', txt);
    return null;
}

const data = await response.json() as any;



return data;

    } catch (error) {
        console.error('Lineage error:', error);
        return null;
    }
}

async getDataQuality(tableFqn: string): Promise<any[]> {
    try {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json'
        };
        if (this.token.trim()) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const entityLink = `<#E::table::${tableFqn}>`;
const encoded = encodeURIComponent(entityLink);
const url = `${this.baseUrl}/api/v1/dataQuality/testCases?entityLink=${encoded}&limit=5&latest=true`;
console.log('Fetching DQ:', url);

        const response = await fetch(url, { headers });
        if (!response.ok) return [];

        const data = await response.json() as any;
        return data.data || [];

    } catch (error) {
        console.error('DQ error:', error);
        return [];
    }
}
}