import * as vscode from 'vscode';

export type ExplorerNode = ImportNode | MemberNode;

export interface ImportNode {
    kind: 'import';
    name: string;
    modulePath: string;
    isNamespace: boolean; // true for `import * as X`
    location: vscode.Location;
    isManuallyAdded?: boolean; // true for packages added via "Browse Package"
}

export interface MemberNode {
    kind: 'member';
    name: string;
    detail: string;
    symbolKind: vscode.SymbolKind;
    modulePath: string;
    documentation?: string;
}

export class TypeExplorerProvider implements vscode.TreeDataProvider<ExplorerNode> {
    private _onDidChangeTreeData = new vscode.EventEmitter<ExplorerNode | undefined | null | void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private memberCache = new Map<string, MemberNode[]>();
    private manualPackages: ImportNode[] = [];

    constructor() {
        vscode.window.onDidChangeActiveTextEditor(() => this.refresh());
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (vscode.window.activeTextEditor?.document === e.document) {
                // Debounce
                this.refresh();
            }
        });
    }

    refresh(): void {
        this.memberCache.clear();
        this._onDidChangeTreeData.fire();
    }

    addPackage(packageName: string): void {
        // Check if already exists
        if (this.manualPackages.find(p => p.modulePath === packageName)) {
            return;
        }

        this.manualPackages.push({
            kind: 'import',
            name: packageName,
            modulePath: packageName,
            isNamespace: true,
            isManuallyAdded: true,
            location: new vscode.Location(vscode.Uri.parse(''), new vscode.Range(0, 0, 0, 0))
        });

        this.memberCache.delete(packageName);
        this._onDidChangeTreeData.fire();
    }

    async getInstalledPackages(): Promise<string[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }

        const packages: string[] = [];

        for (const folder of workspaceFolders) {
            try {
                const packageJsonUri = vscode.Uri.joinPath(folder.uri, 'package.json');
                const content = await vscode.workspace.fs.readFile(packageJsonUri);
                const packageJson = JSON.parse(content.toString());

                if (packageJson.dependencies) {
                    packages.push(...Object.keys(packageJson.dependencies));
                }
                if (packageJson.devDependencies) {
                    packages.push(...Object.keys(packageJson.devDependencies));
                }
            } catch {
                // No package.json or couldn't parse
            }
        }

        return [...new Set(packages)].sort();
    }

    getTreeItem(element: ExplorerNode): vscode.TreeItem {
        if (element.kind === 'import') {
            const item = new vscode.TreeItem(element.modulePath, vscode.TreeItemCollapsibleState.Collapsed);
            item.description = element.isManuallyAdded ? '(browsing)' : (element.isNamespace ? `* as ${element.name}` : element.name);
            item.iconPath = new vscode.ThemeIcon('package');
            item.contextValue = 'import';
            item.tooltip = new vscode.MarkdownString(`**${element.modulePath}**\n\nImported as \`${element.name}\``);
            return item;
        } else {
            const item = new vscode.TreeItem(element.name, vscode.TreeItemCollapsibleState.None);
            item.description = element.detail;
            item.iconPath = this.getIconForSymbolKind(element.symbolKind);
            item.contextValue = 'member';

            if (element.documentation) {
                const tooltip = new vscode.MarkdownString();
                tooltip.appendCodeblock(element.detail || element.name, 'typescript');
                tooltip.appendMarkdown('\n\n---\n\n');
                tooltip.appendMarkdown(element.documentation);
                tooltip.isTrusted = true;
                item.tooltip = tooltip;
            } else if (element.detail) {
                const tooltip = new vscode.MarkdownString();
                tooltip.appendCodeblock(element.detail, 'typescript');
                item.tooltip = tooltip;
            }

            // Double-click to show full docs
            item.command = {
                command: 'type-explorer.showDocumentation',
                title: 'Show Documentation',
                arguments: [element]
            };

            return item;
        }
    }

    private getIconForSymbolKind(kind: vscode.SymbolKind): vscode.ThemeIcon {
        const iconMap: Record<number, string> = {
            [vscode.SymbolKind.Class]: 'symbol-class',
            [vscode.SymbolKind.Interface]: 'symbol-interface',
            [vscode.SymbolKind.Function]: 'symbol-function',
            [vscode.SymbolKind.Method]: 'symbol-method',
            [vscode.SymbolKind.Property]: 'symbol-property',
            [vscode.SymbolKind.Field]: 'symbol-field',
            [vscode.SymbolKind.Variable]: 'symbol-variable',
            [vscode.SymbolKind.Constant]: 'symbol-constant',
            [vscode.SymbolKind.Enum]: 'symbol-enum',
            [vscode.SymbolKind.EnumMember]: 'symbol-enum-member',
            [vscode.SymbolKind.TypeParameter]: 'symbol-type-parameter',
            [vscode.SymbolKind.Struct]: 'symbol-struct',
            [vscode.SymbolKind.Namespace]: 'symbol-namespace',
            [vscode.SymbolKind.Module]: 'symbol-module',
            [vscode.SymbolKind.Constructor]: 'symbol-method',
        };
        return new vscode.ThemeIcon(iconMap[kind] ?? 'symbol-misc');
    }

    private completionKindToSymbolKind(kind: vscode.CompletionItemKind | undefined): vscode.SymbolKind {
        const map: Record<number, vscode.SymbolKind> = {
            [vscode.CompletionItemKind.Method]: vscode.SymbolKind.Method,
            [vscode.CompletionItemKind.Function]: vscode.SymbolKind.Function,
            [vscode.CompletionItemKind.Property]: vscode.SymbolKind.Property,
            [vscode.CompletionItemKind.Field]: vscode.SymbolKind.Field,
            [vscode.CompletionItemKind.Variable]: vscode.SymbolKind.Variable,
            [vscode.CompletionItemKind.Class]: vscode.SymbolKind.Class,
            [vscode.CompletionItemKind.Interface]: vscode.SymbolKind.Interface,
            [vscode.CompletionItemKind.Module]: vscode.SymbolKind.Module,
            [vscode.CompletionItemKind.Enum]: vscode.SymbolKind.Enum,
            [vscode.CompletionItemKind.EnumMember]: vscode.SymbolKind.EnumMember,
            [vscode.CompletionItemKind.Constant]: vscode.SymbolKind.Constant,
            [vscode.CompletionItemKind.Constructor]: vscode.SymbolKind.Constructor,
            [vscode.CompletionItemKind.TypeParameter]: vscode.SymbolKind.TypeParameter,
            [vscode.CompletionItemKind.Event]: vscode.SymbolKind.Event,
        };
        return map[kind ?? -1] ?? vscode.SymbolKind.Variable;
    }

    async getChildren(element?: ExplorerNode): Promise<ExplorerNode[]> {
        if (!element) {
            return this.findImportedModules();
        }

        if (element.kind === 'import') {
            return this.getModuleExports(element);
        }

        return [];
    }

    private async findImportedModules(): Promise<ImportNode[]> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return [];
        }

        const document = editor.document;
        const text = document.getText();
        const modules = new Map<string, ImportNode>();

        // Standard imports: import X from 'module' or import { X } from 'module'
        const standardRegex = /import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = standardRegex.exec(text)) !== null) {
            const modulePath = match[3];
            const defaultImport = match[1];
            const namedImports = match[2];
            const line = document.positionAt(match.index).line;

            if (!modules.has(modulePath)) {
                const importName = defaultImport || (namedImports ? namedImports.split(',')[0].trim().split(/\s+as\s+/).pop()?.trim() : modulePath);
                modules.set(modulePath, {
                    kind: 'import',
                    name: importName || modulePath,
                    modulePath,
                    isNamespace: false,
                    location: new vscode.Location(document.uri, new vscode.Position(line, 0))
                });
            }
        }

        // Namespace imports: import * as X from 'module'
        const namespaceRegex = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;
        while ((match = namespaceRegex.exec(text)) !== null) {
            const name = match[1];
            const modulePath = match[2];
            const line = document.positionAt(match.index).line;

            modules.set(modulePath, {
                kind: 'import',
                name,
                modulePath,
                isNamespace: true,
                location: new vscode.Location(document.uri, new vscode.Position(line, 0))
            });
        }

        // Type imports
        const typeRegex = /import\s+type\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g;
        while ((match = typeRegex.exec(text)) !== null) {
            const namedImports = match[1];
            const modulePath = match[2];
            const line = document.positionAt(match.index).line;

            if (!modules.has(modulePath)) {
                const firstName = namedImports.split(',')[0].trim().split(/\s+as\s+/).pop()?.trim();
                modules.set(modulePath, {
                    kind: 'import',
                    name: firstName || modulePath,
                    modulePath,
                    isNamespace: false,
                    location: new vscode.Location(document.uri, new vscode.Position(line, 0))
                });
            }
        }

        // Add manually browsed packages that aren't already imported
        for (const pkg of this.manualPackages) {
            if (!modules.has(pkg.modulePath)) {
                modules.set(pkg.modulePath, pkg);
            }
        }

        return Array.from(modules.values());
    }

    private async getModuleExports(importNode: ImportNode): Promise<MemberNode[]> {
        if (this.memberCache.has(importNode.modulePath)) {
            return this.memberCache.get(importNode.modulePath)!;
        }

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return [];
        }

        const document = editor.document;

        try {
            const text = document.getText();
            const members: MemberNode[] = [];

            // First, collect already imported items from this module
            const alreadyImported = this.getAlreadyImportedNames(text, importNode.modulePath);

            // Get completions to find all available exports
            let completionPosition: vscode.Position;
            let triggerChar: string | undefined;

            if (importNode.isNamespace) {
                // For namespace imports, find usage like `name.` to get completions
                const usageRegex = new RegExp(`\\b${importNode.name}\\.`, 'g');
                const usageMatch = usageRegex.exec(text);

                if (usageMatch) {
                    const dotPos = usageMatch.index + usageMatch[0].length;
                    completionPosition = document.positionAt(dotPos);
                    triggerChar = '.';
                } else {
                    return this.getExportsViaDefinition(importNode, document);
                }
            } else {
                // For named imports, position inside the braces
                const importRegex = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${this.escapeRegex(importNode.modulePath)}['"]`);
                const importMatch = importRegex.exec(text);

                if (importMatch) {
                    const bracePos = text.indexOf('{', importMatch.index);
                    completionPosition = document.positionAt(bracePos + 1);
                } else {
                    return this.getExportsViaDefinition(importNode, document);
                }
            }

            const completions = await vscode.commands.executeCommand<vscode.CompletionList>(
                'vscode.executeCompletionItemProvider',
                document.uri,
                completionPosition,
                triggerChar
            );

            if (!completions || completions.items.length === 0) {
                return this.getExportsViaDefinition(importNode, document);
            }

            // Process completion items
            const completionMembers = await this.processCompletionItems(completions.items, importNode.modulePath, document);

            // Add already imported items that aren't in completions (they get filtered out)
            for (const name of alreadyImported) {
                if (!completionMembers.find(m => m.name === name)) {
                    // Get documentation for this already-imported item
                    const doc = await this.getDocumentationForImportedName(name, document);
                    completionMembers.push({
                        kind: 'member',
                        name,
                        detail: '',
                        symbolKind: vscode.SymbolKind.Variable,
                        modulePath: importNode.modulePath,
                        documentation: doc
                    });
                }
            }

            // Sort
            completionMembers.sort((a, b) => {
                const priority = (kind: vscode.SymbolKind) => {
                    switch (kind) {
                        case vscode.SymbolKind.Class: return 0;
                        case vscode.SymbolKind.Interface: return 1;
                        case vscode.SymbolKind.Enum: return 2;
                        case vscode.SymbolKind.Function: return 3;
                        case vscode.SymbolKind.Constant: return 4;
                        default: return 5;
                    }
                };
                const pa = priority(a.symbolKind);
                const pb = priority(b.symbolKind);
                if (pa !== pb) {
                    return pa - pb;
                }
                return a.name.localeCompare(b.name);
            });

            this.memberCache.set(importNode.modulePath, completionMembers);
            return completionMembers;
        } catch (error) {
            console.error('Error getting module exports:', error);
            return [];
        }
    }

    private getAlreadyImportedNames(text: string, modulePath: string): string[] {
        const names: string[] = [];

        // Match: import { x, y as z } from 'modulePath'
        const importRegex = new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*['"]${this.escapeRegex(modulePath)}['"]`, 'g');
        let match;
        while ((match = importRegex.exec(text)) !== null) {
            const namedPart = match[1];
            for (const item of namedPart.split(',')) {
                const trimmed = item.trim();
                if (trimmed) {
                    // Handle "x as y" - we want the original name "x"
                    const originalName = trimmed.split(/\s+as\s+/)[0].trim();
                    if (originalName && !names.includes(originalName)) {
                        names.push(originalName);
                    }
                }
            }
        }

        // Match: import DefaultExport from 'modulePath'
        const defaultRegex = new RegExp(`import\\s+(\\w+)\\s*(?:,\\s*\\{[^}]*\\})?\\s*from\\s*['"]${this.escapeRegex(modulePath)}['"]`);
        const defaultMatch = defaultRegex.exec(text);
        if (defaultMatch && defaultMatch[1] && !names.includes(defaultMatch[1])) {
            names.push(defaultMatch[1]);
        }

        return names;
    }

    private async getDocumentationForImportedName(name: string, document: vscode.TextDocument): Promise<string | undefined> {
        // Find where this name is used and get hover info
        const text = document.getText();
        const nameRegex = new RegExp(`\\b${name}\\b`);
        const match = nameRegex.exec(text);

        if (!match) {
            return undefined;
        }

        const position = document.positionAt(match.index);

        try {
            const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
                'vscode.executeHoverProvider',
                document.uri,
                position
            );

            if (hovers && hovers.length > 0) {
                return hovers
                    .flatMap(h => h.contents)
                    .map(c => typeof c === 'string' ? c : 'value' in c ? c.value : '')
                    .filter(s => s)
                    .join('\n\n');
            }
        } catch {
            // Ignore
        }

        return undefined;
    }


    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private async getExportsViaDefinition(importNode: ImportNode, document: vscode.TextDocument): Promise<MemberNode[]> {
        try {
            // Get definition of the import and analyze that file
            const definitions = await vscode.commands.executeCommand<vscode.Location[] | vscode.LocationLink[]>(
                'vscode.executeDefinitionProvider',
                document.uri,
                importNode.location.range.start
            );

            if (!definitions || definitions.length === 0) {
                return [];
            }

            const def = definitions[0];
            const defUri = 'targetUri' in def ? def.targetUri : def.uri;

            // Skip if it points back to the same file
            if (defUri.toString() === document.uri.toString()) {
                return [];
            }

            // Get document symbols from the definition file
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                defUri
            );

            if (!symbols || symbols.length === 0) {
                return [];
            }

            const members: MemberNode[] = [];

            for (const symbol of symbols) {
                // Get hover for documentation
                const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    defUri,
                    symbol.selectionRange.start
                );

                let documentation: string | undefined;
                if (hovers && hovers.length > 0) {
                    documentation = hovers
                        .flatMap(h => h.contents)
                        .map(c => typeof c === 'string' ? c : 'value' in c ? c.value : '')
                        .join('\n\n');
                }

                members.push({
                    kind: 'member',
                    name: symbol.name,
                    detail: symbol.detail,
                    symbolKind: symbol.kind,
                    modulePath: importNode.modulePath,
                    documentation
                });
            }

            this.memberCache.set(importNode.modulePath, members);
            return members;
        } catch (error) {
            console.error('Error getting exports via definition:', error);
            return [];
        }
    }

    private async processCompletionItems(items: vscode.CompletionItem[], modulePath: string, document: vscode.TextDocument): Promise<MemberNode[]> {
        const members: MemberNode[] = [];

        for (const item of items) {
            // Skip non-export items
            if (item.kind === vscode.CompletionItemKind.Keyword ||
                item.kind === vscode.CompletionItemKind.Snippet ||
                item.kind === vscode.CompletionItemKind.Text) {
                continue;
            }

            const label = typeof item.label === 'string' ? item.label : item.label.label;
            const detail = typeof item.label === 'object' && item.label.detail
                ? item.label.detail
                : (item.detail || '');

            // Use documentation already present on the completion item (no resolve)
            let documentation: string | undefined;
            if (item.documentation) {
                documentation = typeof item.documentation === 'string'
                    ? item.documentation
                    : item.documentation.value;
            }

            // If no documentation from completion, try hover on the symbol if it's imported
            if (!documentation) {
                documentation = await this.getDocumentationForImportedName(label, document);
            }

            members.push({
                kind: 'member',
                name: label,
                detail: detail,
                symbolKind: this.completionKindToSymbolKind(item.kind),
                modulePath,
                documentation
            });
        }

        return members;
    }
}
