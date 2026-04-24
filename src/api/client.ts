import * as vscode from 'vscode';

export interface TableMetadata {
    name: string;
    fullyQualifiedName: string;
    description: string;
    owner: string;
    tier: string;
    tags: string[];
    dqScore: number | null;
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
            `${this.baseUrl}/api/v1/tables/name/${encodedName}`;

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
            description: data.description || "No description",
            owner: data.owner?.displayName || data.owner?.name || "Unknown",
            tier: tierTag.replace("Tier.", "") || "Not set",
            tags: data.tags?.map((t: any) => t.tagFQN) || [],
            dqScore: null
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
}