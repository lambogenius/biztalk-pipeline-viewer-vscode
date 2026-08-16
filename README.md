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

Reload VS Code after installation. Double-click a `.btp` file to use the
viewer. Use **Open With... > Text Editor** or the viewer's **Open as text**
button to inspect the source XML.

Before publishing publicly, replace the `publisher` value in `package.json`
and add the intended license.
