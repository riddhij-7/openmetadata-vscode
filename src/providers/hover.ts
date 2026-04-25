import * as vscode from 'vscode';
import { TableMetadata } from '../api/client';
import { MetadataCache } from '../cache/metadataCache';
import { Prefetcher } from './prefetcher';
import { parseAliases } from './aliasParser';

const SQL_KEYWORDS = /^(SELECT|FROM|WHERE|JOIN|ON|AND|OR|NOT|IN|IS|NULL|AS|BY|GROUP|ORDER|HAVING|LIMIT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|INDEX|VIEW|WITH|CASE|WHEN|THEN|ELSE|END|DISTINCT|UNION|ALL|INTO|SET|VALUES|LEFT|RIGHT|INNER|OUTER|FULL|CROSS|TRUE|FALSE|COUNT|SUM|AVG|MIN|MAX)$/i;

export class OpenMetadataHoverProvider implements vscode.HoverProvider {
    private cache: MetadataCache;
    private prefetcher: Prefetcher;

    constructor(cache: MetadataCache, prefetcher: Prefetcher) {
        this.cache = cache;
        this.prefetcher = prefetcher;
    }

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {

        const wordRange = document.getWordRangeAtPosition(position, /[\w.]+/);
        if (!wordRange) return null;

        const raw = document.getText(wordRange);
        const docText = document.getText();
        const aliases = parseAliases(docText);
        const resolved = this.resolveToken(raw, aliases);
        const candidates = this.extractCandidates(resolved);

        // Filter out pure SQL keywords and short tokens
        const viable = candidates.filter(w => w.length >= 3 && !SQL_KEYWORDS.test(w));
        if (viable.length === 0) return null;

        // Check cache / dead state for all candidates first (instant)
        for (const word of viable) {
            const cached = this.cache.getTable(word);
            if (cached) return this.buildHover(cached.data, wordRange);
        }

        // Check if all candidates are already dead (not_found / failed)
        const deadStates = viable.map(w => this.prefetcher.getDeadState(w)).filter(Boolean);
        if (deadStates.length === viable.length) {
            // Every candidate failed — show appropriate message for the most relevant word
            const state = this.prefetcher.getDeadState(viable[viable.length - 1]);
            return this.buildErrorHover(resolved.split('.').pop() ?? raw, wordRange, state!);
        }

        // Wait for any in-flight fetches
        const inFlightPromises = viable
            .map(w => this.prefetcher.getInFlight(w))
            .filter((p): p is Promise<any> => p !== undefined);

        if (inFlightPromises.length > 0) {
            await Promise.race([
                Promise.all(inFlightPromises),
                new Promise(resolve => token.onCancellationRequested(resolve))
            ]);
        } else {
            // Nothing in flight — trigger fetch now
            this.prefetcher.prefetch(raw, docText);
            const newInFlight = viable
                .map(w => this.prefetcher.getInFlight(w))
                .filter((p): p is Promise<any> => p !== undefined);
            if (newInFlight.length > 0) {
                await Promise.race([
                    Promise.all(newInFlight),
                    new Promise(resolve => token.onCancellationRequested(resolve))
                ]);
            }
        }

        if (token.isCancellationRequested) return null;

        // Check cache again after fetch
        for (const word of viable) {
            const fetched = this.cache.getTable(word);
            if (fetched) return this.buildHover(fetched.data, wordRange);
        }

        // Still nothing — show error for the shortest (most likely table name) candidate
        const tableName = viable[viable.length - 1];
        const state = this.prefetcher.getDeadState(tableName);
        if (state) {
            return this.buildErrorHover(tableName.split('.').pop() ?? tableName, wordRange, state);
        }

        return null;
    }

    private resolveToken(raw: string, aliases: Map<string, string>): string {
        const dotIndex = raw.indexOf('.');
        if (dotIndex === -1) return aliases.get(raw) ?? raw;
        const prefix = raw.substring(0, dotIndex);
        const resolved = aliases.get(prefix);
        if (resolved) return `${resolved}.${raw.substring(dotIndex + 1)}`;
        return raw;
    }

    private extractCandidates(raw: string): string[] {
        const parts = raw.split('.');
        const candidates: string[] = [];
        for (let i = parts.length; i >= 1; i--) {
            candidates.push(parts.slice(0, i).join('.'));
        }
        return candidates;
    }

    private buildErrorHover(name: string, wordRange: vscode.Range, state: 'not_found' | 'failed'): vscode.Hover {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        if (state === 'not_found') {
            md.appendMarkdown(`### 📊 ${name}\n\n❌ *Table not found in OpenMetadata.*`);
        } else {
            md.appendMarkdown(`### 📊 ${name}\n\n⚠️ *Failed to fetch metadata. Check your server URL and token.*`);
        }
        return new vscode.Hover(md, wordRange);
    }

    private buildHover(metadata: TableMetadata, wordRange: vscode.Range): vscode.Hover {
        const fqn = metadata.fullyQualifiedName;
        const lineage = this.cache.getLineage(fqn)?.data ?? null;
        const dqTests: any[] = this.cache.getDQ(fqn)?.data ?? [];
        const extrasLoading = !this.cache.getLineage(fqn) || !this.cache.getDQ(fqn);

        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;

        md.appendMarkdown(`### 📊 ${metadata.name}\n\n`);
        md.appendMarkdown(`${metadata.description}\n\n`);
        md.appendMarkdown(`**Owner:** ${metadata.owner} &nbsp;|&nbsp; **Tier:** ${metadata.tier || 'Not set'}\n\n`);

        if (metadata.tags.length > 0) {
            md.appendMarkdown(`**Tags:** ${metadata.tags.map(t => `\`${t}\``).join(' ')}\n\n`);
        }

        if (metadata.columns.length > 0) {
            md.appendMarkdown(`**Columns:**\n\n`);
            metadata.columns.forEach(col => {
                md.appendMarkdown(`- \`${col.name}\` — *${col.dataType}*${col.description ? ': ' + col.description : ''}\n`);
            });
            md.appendMarkdown('\n');
        }

        if (dqTests.length > 0) {
            const passed = dqTests.filter((t: any) => t.testCaseResult?.testCaseStatus === 'Success').length;
            const failed = dqTests.filter((t: any) => t.testCaseResult?.testCaseStatus === 'Failed').length;
            md.appendMarkdown(`**Data Quality:** ${failed > 0 ? '❌' : '✅'} ${passed} passed, ${failed} failed\n\n`);
            dqTests.slice(0, 3).forEach((t: any) => {
                md.appendMarkdown(`- ${t.testCaseResult?.testCaseStatus === 'Success' ? '✅' : '❌'} \`${t.name}\`\n`);
            });
            md.appendMarkdown('\n');
        } else if (!extrasLoading) {
            md.appendMarkdown(`**Data Quality:** No tests found\n\n`);
        }

        if (lineage) {
            const upEdges = Object.values(lineage.upstreamEdges || {}) as any[];
            const downEdges = Object.values(lineage.downstreamEdges || {}) as any[];
            const upstream = upEdges.filter((e: any) => e.toEntity?.fullyQualifiedName === fqn).map((e: any) => e.fromEntity?.fullyQualifiedName);
            const downstream = downEdges.filter((e: any) => e.fromEntity?.fullyQualifiedName === fqn).map((e: any) => e.toEntity?.fullyQualifiedName);
            md.appendMarkdown(`**⬆ Upstream:** ${upstream.length ? upstream.slice(0, 3).map((u: string) => `\`${u}\``).join(', ') : 'None'}\n\n`);
            md.appendMarkdown(`**⬇ Downstream:** ${downstream.length ? downstream.slice(0, 3).map((d: string) => `\`${d}\``).join(', ') : 'None'}\n\n`);
        } else if (extrasLoading) {
            md.appendMarkdown(`*⏳ Loading lineage & quality… hover again for full details.*\n\n`);
        }

        md.appendMarkdown(`---\n[🔗 View in OpenMetadata](${metadata.tableUrl})`);
        return new vscode.Hover(md, wordRange);
    }
}
