import * as vscode from 'vscode';
import { OpenMetadataHoverProvider } from './providers/hover';
import { Prefetcher } from './providers/prefetcher';
import { OpenMetadataClient } from './api/client';
import { MetadataCache } from './cache/metadataCache';

const SUPPORTED_LANGUAGES = ['sql', 'python', 'yaml'];

export function activate(context: vscode.ExtensionContext) {
    console.log('OpenMetadata extension is now active!');

    const cache = new MetadataCache();
    const prefetcher = new Prefetcher(cache);

    // Prefetch on cursor move 
    const selectionListener = vscode.window.onDidChangeTextEditorSelection(event => {
        const editor = event.textEditor;
        if (!SUPPORTED_LANGUAGES.includes(editor.document.languageId)) return;

        const position = event.selections[0].active;
        const wordRange = editor.document.getWordRangeAtPosition(position, /[\w.]+/);
        if (!wordRange) return;

        const word = editor.document.getText(wordRange);
        prefetcher.prefetch(word, editor.document.getText());
    });

    const hoverProvider = vscode.languages.registerHoverProvider(
        SUPPORTED_LANGUAGES.map(language => ({ language })),
        new OpenMetadataHoverProvider(cache, prefetcher)
    );

    const searchCommand = vscode.commands.registerCommand(
        'openmetadata-vscode.search',
        async () => {
            const query = await vscode.window.showInputBox({
                prompt: 'Search OpenMetadata tables...',
                placeHolder: 'e.g. customers, orders, products'
            });

            if (!query) return;

            const client = new OpenMetadataClient();
            const results = await client.searchTables(query);

            if (results.length === 0) {
                vscode.window.showInformationMessage('No tables found for: ' + query);
                return;
            }

            const items = results.map((r: any) => ({
                label: r._source?.name || r._source?.fullyQualifiedName,
                description: r._source?.description || 'No description'
            }));

            const picked = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a table to view'
            });

            if (picked) {
                vscode.window.showInformationMessage(`Selected: ${picked.label}`);
            }
        }
    );

    context.subscriptions.push(hoverProvider, searchCommand, selectionListener);
}

export function deactivate() {}
