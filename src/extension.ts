import * as vscode from 'vscode';
import { TypeExplorerProvider, MemberNode } from './TypeExplorerProvider';

let docPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {

	// Create and register the Type Explorer tree view
	const typeExplorerProvider = new TypeExplorerProvider();
	vscode.window.registerTreeDataProvider('typeExplorer', typeExplorerProvider);

	// Register refresh command
	const refreshCommand = vscode.commands.registerCommand('type-explorer.refresh', () => {
		typeExplorerProvider.refresh();
	});

	// Browse any installed package
	const browsePackageCommand = vscode.commands.registerCommand('type-explorer.browsePackage', async () => {
		const packages = await typeExplorerProvider.getInstalledPackages();

		if (packages.length === 0) {
			// Allow typing any package name
			const packageName = await vscode.window.showInputBox({
				prompt: 'Enter package name to browse',
				placeHolder: 'e.g., lodash, express, @tanstack/ai'
			});

			if (packageName) {
				typeExplorerProvider.addPackage(packageName);
			}
			return;
		}

		const selected = await vscode.window.showQuickPick(
			[
				{ label: '$(edit) Enter package name...', description: 'Type any package name', isCustom: true },
				...packages.map(p => ({ label: p, description: '', isCustom: false }))
			],
			{
				placeHolder: 'Select a package to browse',
				matchOnDescription: true
			}
		);

		if (!selected) {
			return;
		}

		if (selected.isCustom) {
			const packageName = await vscode.window.showInputBox({
				prompt: 'Enter package name to browse',
				placeHolder: 'e.g., lodash, express, @tanstack/ai'
			});

			if (packageName) {
				typeExplorerProvider.addPackage(packageName);
			}
		} else {
			typeExplorerProvider.addPackage(selected.label);
		}
	});

	// Show documentation in a webview panel
	const showDocCommand = vscode.commands.registerCommand('type-explorer.showDocumentation', (member: MemberNode) => {
		if (!member || member.kind !== 'member') {
			return;
		}

		if (docPanel) {
			docPanel.reveal(vscode.ViewColumn.Beside);
		} else {
			docPanel = vscode.window.createWebviewPanel(
				'typeExplorerDoc',
				'Documentation',
				vscode.ViewColumn.Beside,
				{ enableScripts: true }
			);

			docPanel.onDidDispose(() => {
				docPanel = undefined;
			});
		}

		docPanel.title = member.name;
		docPanel.webview.html = getDocumentationHtml(member);
	});

	context.subscriptions.push(refreshCommand, showDocCommand, browsePackageCommand);
}

function getDocumentationHtml(member: MemberNode): string {
	const escapeHtml = (str: string) => str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

	const name = escapeHtml(member.name);
	const detail = member.detail ? escapeHtml(member.detail) : '';
	const doc = member.documentation || 'No documentation available.';
	const modulePath = escapeHtml(member.modulePath);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${name}</title>
	<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
	<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/highlight.js@11/styles/vs2015.min.css">
	<script src="https://cdn.jsdelivr.net/npm/highlight.js@11"></script>
	<style>
		body {
			font-family: var(--vscode-font-family);
			padding: 20px;
			color: var(--vscode-foreground);
			background: var(--vscode-editor-background);
			line-height: 1.6;
		}
		h1 {
			color: var(--vscode-textLink-foreground);
			margin-bottom: 5px;
			font-size: 1.5em;
		}
		h2 {
			color: var(--vscode-textLink-foreground);
			margin-top: 1.5em;
			font-size: 1.3em;
			border-bottom: 1px solid var(--vscode-widget-border);
			padding-bottom: 5px;
		}
		h3 {
			color: var(--vscode-textLink-foreground);
			margin-top: 1.2em;
			font-size: 1.1em;
		}
		h4 {
			color: var(--vscode-textLink-foreground);
			margin-top: 1em;
		}
		.module {
			color: var(--vscode-descriptionForeground);
			font-size: 0.9em;
			margin-bottom: 20px;
		}
		.signature {
			background: var(--vscode-textBlockQuote-background);
			padding: 12px;
			border-radius: 4px;
			font-family: var(--vscode-editor-font-family);
			font-size: var(--vscode-editor-font-size);
			overflow-x: auto;
			margin-bottom: 20px;
			white-space: pre-wrap;
		}
		code {
			background: var(--vscode-textBlockQuote-background);
			padding: 2px 6px;
			border-radius: 3px;
			font-family: var(--vscode-editor-font-family);
		}
		pre {
			background: var(--vscode-textBlockQuote-background);
			padding: 12px;
			border-radius: 4px;
			overflow-x: auto;
		}
		pre code {
			padding: 0;
			background: transparent;
		}
		hr {
			border: none;
			border-top: 1px solid var(--vscode-widget-border);
			margin: 20px 0;
		}
		ul, ol {
			padding-left: 20px;
		}
		li {
			margin: 5px 0;
		}
		strong {
			color: var(--vscode-textLink-activeForeground);
		}
		a {
			color: var(--vscode-textLink-foreground);
		}
		blockquote {
			border-left: 3px solid var(--vscode-textBlockQuote-border);
			margin: 10px 0;
			padding-left: 15px;
			color: var(--vscode-descriptionForeground);
		}
		table {
			border-collapse: collapse;
			width: 100%;
			margin: 15px 0;
		}
		th, td {
			border: 1px solid var(--vscode-widget-border);
			padding: 8px;
			text-align: left;
		}
		th {
			background: var(--vscode-textBlockQuote-background);
		}
	</style>
</head>
<body>
	<h1>${name}</h1>
	<div class="module">from <code>${modulePath}</code></div>
	${detail ? `<div class="signature">${detail}</div>` : ''}
	<hr>
	<div id="documentation"></div>
	<script>
		const docContent = ${JSON.stringify(doc)};
		marked.setOptions({
			highlight: function(code, lang) {
				if (lang && hljs.getLanguage(lang)) {
					return hljs.highlight(code, { language: lang }).value;
				}
				return hljs.highlightAuto(code).value;
			},
			breaks: true,
			gfm: true
		});
		document.getElementById('documentation').innerHTML = marked.parse(docContent);
	</script>
</body>
</html>`;
}

export function deactivate() {
	if (docPanel) {
		docPanel.dispose();
	}
}
