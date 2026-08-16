# BizTalk Pipeline Viewer for VS Code

A local-only custom editor for BizTalk `*.btp` pipeline files. It displays the
pipeline direction, ordered stages, components, and configured component
properties without requiring BizTalk Server or Visual Studio.

## Development

```powershell
npm install
npm run check
npm run package
code --install-extension .\biztalk-pipeline-viewer-0.1.0.vsix
```

To install dependencies, validate, and package the extension:

```powershell
npm run build-package
```

To build the extension, uninstall the current version, and install the newly
built VSIX:

```powershell
npm run reinstall
```

Use `-CodeCommand code-insiders` when running `scripts\reinstall.ps1` directly
to target VS Code Insiders. Both scripts accept `-SkipInstall` to reuse the
current `node_modules` folder.

Reload VS Code after installation. Double-click a `.btp` file to use the
viewer. Use **Open With... > Text Editor** or the viewer's **Open as text**
button to inspect the source XML.

Before publishing publicly, replace the `publisher` value in `package.json`.

This project is available under the MIT License. See `LICENSE`.
