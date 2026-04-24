import * as vscode from 'vscode';
import { OpenMetadataClient } from '../api/client';

export class OpenMetadataHoverProvider implements vscode.HoverProvider {
    private client: OpenMetadataClient;

    constructor() {
        this.client = new OpenMetadataClient();
    }

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Hover | null> {

        const wordRange = document.getWordRangeAtPosition(position, /[\w.]+/);
        if (!wordRange) return null;

        const word = document.getText(wordRange);
        if (word.length < 3) return null;

        console.log('Fetching metadata for:', word);

        // Fetch all three in parallel
        const metadata = await this.client.getTable(word);
        if (!metadata) return null;

        const [lineage, dqTests] = await Promise.all([
            this.client.getLineage(metadata.fullyQualifiedName),
            this.client.getDataQuality(metadata.fullyQualifiedName)
        ]);

        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;

        // Header
        md.appendMarkdown(`### 📊 ${metadata.name}\n\n`);

        // Description
        md.appendMarkdown(`${metadata.description}\n\n`);

        // Owner + Tier in one line
        md.appendMarkdown(`**Owner:** ${metadata.owner} &nbsp;|&nbsp; **Tier:** ${metadata.tier || 'Not set'}\n\n`);

        // Tags
        if (metadata.tags.length > 0) {
            const tagBadges = metadata.tags.map(t => `\`${t}\``).join(' ');
            md.appendMarkdown(`**Tags:** ${tagBadges}\n\n`);
        }

        // Columns (top 5)
        if (metadata.columns.length > 0) {
            md.appendMarkdown(`**Columns:**\n\n`);
            metadata.columns.forEach(col => {
                md.appendMarkdown(`- \`${col.name}\` — *${col.dataType}*${col.description ? ': ' + col.description : ''}\n`);
            });
            md.appendMarkdown('\n');
        }

        // Data Quality
        if (dqTests && dqTests.length > 0) {
            const passed = dqTests.filter((t: any) => t.testCaseResult?.testCaseStatus === 'Success').length;
            const failed = dqTests.filter((t: any) => t.testCaseResult?.testCaseStatus === 'Failed').length;
            const icon = failed > 0 ? '❌' : '✅';
            md.appendMarkdown(`**Data Quality:** ${icon} ${passed} passed, ${failed} failed\n\n`);

            dqTests.slice(0, 3).forEach((t: any) => {
                const status = t.testCaseResult?.testCaseStatus === 'Success' ? '✅' : '❌';
                md.appendMarkdown(`- ${status} \`${t.name}\`\n`);
            });
            md.appendMarkdown('\n');
        } else {
            md.appendMarkdown(`**Data Quality:** No tests found\n\n`);
        }

        // Lineage
if (lineage) {
    const downstreamEdges = Object.values(lineage.downstreamEdges || {}) as any[];
    const upstreamEdges = Object.values(lineage.upstreamEdges || {}) as any[];

    // Upstream = edges where THIS table is the toEntity
    const upstream = upstreamEdges
        .filter((e: any) => e.toEntity?.fullyQualifiedName === metadata.fullyQualifiedName)
        .map((e: any) => e.fromEntity?.fullyQualifiedName || 'Unknown');

    // Downstream = edges where THIS table is the fromEntity  
    const downstream = downstreamEdges
        .filter((e: any) => e.fromEntity?.fullyQualifiedName === metadata.fullyQualifiedName)
        .map((e: any) => e.toEntity?.fullyQualifiedName || 'Unknown');

    if (upstream.length > 0) {
        md.appendMarkdown(`**⬆ Upstream:** ${upstream.slice(0, 3).map((u: string) => `\`${u}\``).join(', ')}\n\n`);
    } else {
        md.appendMarkdown(`**⬆ Upstream:** None\n\n`);
    }

    if (downstream.length > 0) {
        md.appendMarkdown(`**⬇ Downstream:** ${downstream.slice(0, 3).map((d: string) => `\`${d}\``).join(', ')}\n\n`);
    } else {
        md.appendMarkdown(`**⬇ Downstream:** None\n\n`);
    }
}

        // Footer link
        md.appendMarkdown(`---\n`);
        md.appendMarkdown(`[🔗 View in OpenMetadata](${metadata.tableUrl})`);

        return new vscode.Hover(md, wordRange);
    }
}