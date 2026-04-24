import * as vscode from 'vscode';
import { OpenMetadataHoverProvider } from './providers/hover';
import { OpenMetadataClient } from './api/client';

export function activate(context: vscode.ExtensionContext) {
    console.log('OpenMetadata extension is now active!');

    // Register hover provider for SQL, Python, YAML files
    const hoverProvider = vscode.languages.registerHoverProvider(
        [
            { language: 'sql' },
            { language: 'python' },
            { language: 'yaml' }
        ],
        new OpenMetadataHoverProvider()
    );

    // Register search command
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

    context.subscriptions.push(hoverProvider, searchCommand);
}

export function deactivate() {}