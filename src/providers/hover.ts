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

        console.log('Hover triggered!');

        const wordRange = document.getWordRangeAtPosition(position, /[\w.]+/);
        if (!wordRange) return null;

        const word = document.getText(wordRange);
        console.log('Word:', word);
        if (word.length < 3) return null;

        const metadata = await this.client.getTable(word);
        console.log("Searching table:", word);
console.log("Returned:", JSON.stringify(metadata, null, 2));
        if (!metadata) return null;

        const md = new vscode.MarkdownString();
        md.isTrusted = true;

        md.appendMarkdown(`### 📊 ${metadata.name}\n\n`);
        md.appendMarkdown(`**Description:** ${metadata.description}\n\n`);
        md.appendMarkdown(`**Owner:** ${metadata.owner}\n\n`);
        md.appendMarkdown(`**Tier:** ${metadata.tier}\n\n`);

        if (metadata.tags.length > 0) {
            md.appendMarkdown(`**Tags:** ${metadata.tags.join(', ')}\n\n`);
        }

        md.appendMarkdown(`---\n`);
        md.appendMarkdown(`[View in OpenMetadata](https://sandbox.open-metadata.org/table/${metadata.fullyQualifiedName})`);

        return new vscode.Hover(md, wordRange);
    }
}