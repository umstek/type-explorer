# Type Explorer

> ⚠️ **Preview** - This extension is in early development.

The missing Object Browser for VS Code. Browse imports, explore module exports, and view documentation without leaving your editor.

## Features

- **Browse Imports** - See all modules imported in your current file
- **Explore Exports** - Expand any module to see its available classes, functions, types, and constants
- **View Documentation** - Click any member to view its full documentation in a side panel
- **Browse Any Package** - Explore installed packages even before importing them

![Type Explorer](images/type-explorer.png)

## Usage

1. Open the **Type Explorer** panel in the Explorer sidebar
2. Your current file's imports appear as expandable nodes
3. Click the expand arrow to see available exports from each module
4. Click any export to view its documentation
5. Use the **Browse Package** button to explore packages you haven't imported yet

## Requirements

- Works with TypeScript and JavaScript files
- Requires a language server (TypeScript, ESLint, etc.) for best results

## Known Issues

- Documentation may not be available for some dynamically typed modules
- Some completion items may appear that aren't actual exports

## Release Notes

### 0.1.0

Initial preview release:
- Import detection for TypeScript/JavaScript
- Module export browsing via completions
- Documentation panel with Markdown rendering
- Browse any installed package

---

## Contributing

This extension is open source. Contributions welcome!

## License

MIT
