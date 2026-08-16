'use strict';

const vscode = require('vscode');

const viewType = 'biztalkPipeline.viewer';

class PipelineEditorProvider {
  constructor(context) {
    this.context = context;
  }

  resolveCustomTextEditor(document, panel) {
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')],
    };
    panel.webview.html = this.getHtml(panel.webview);

    const update = () => {
      void panel.webview.postMessage({
        type: 'document',
        fileName: document.fileName.split(/[\\/]/).pop(),
        text: document.getText(),
      });
    };

    const documentSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) update();
    });
    const messageSubscription = panel.webview.onDidReceiveMessage((message) => {
      if (message?.type === 'ready') update();
      if (message?.type === 'openText') {
        void vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
      }
    });

    panel.onDidDispose(() => {
      documentSubscription.dispose();
      messageSubscription.dispose();
    });
  }

  getHtml(webview) {
    const nonce = createNonce();
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', 'styles.css'));

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
  <title>BizTalk Pipeline Viewer</title>
</head>
<body>
  <div id="app"><div class="loading">Loading pipeline…</div></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function createNonce() {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => alphabet.charAt(Math.floor(Math.random() * alphabet.length))).join('');
}

function activate(context) {
  const provider = new PipelineEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    }),
    vscode.commands.registerCommand('biztalkPipeline.openViewer', (uri) => {
      const target = uri || vscode.window.activeTextEditor?.document.uri;
      if (target) return vscode.commands.executeCommand('vscode.openWith', target, viewType);
      return undefined;
    }),
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
