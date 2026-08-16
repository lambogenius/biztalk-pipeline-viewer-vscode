'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { after, before, beforeEach, describe, it } = require('node:test');

const calls = {};
const vscode = {
  Uri: {
    joinPath: (...parts) => parts.map(String).join('/'),
  },
  commands: {
    executeCommand: (...args) => {
      calls.executed.push(args);
      return Promise.resolve(args);
    },
    registerCommand: (name, handler) => {
      calls.command = { name, handler };
      return { dispose() {} };
    },
  },
  window: {
    activeTextEditor: undefined,
    registerCustomEditorProvider: (...args) => {
      calls.providerRegistration = args;
      return { dispose() {} };
    },
  },
  workspace: {
    onDidChangeTextDocument: (handler) => {
      calls.documentHandler = handler;
      return { dispose: () => { calls.documentDisposed = true; } };
    },
  },
};

const originalLoad = Module._load;
let extension;

before(() => {
  Module._load = function load(request, parent, isMain) {
    if (request === 'vscode') return vscode;
    return originalLoad.call(this, request, parent, isMain);
  };
  extension = require('../extension');
});

after(() => {
  Module._load = originalLoad;
});

beforeEach(() => {
  for (const key of Object.keys(calls)) delete calls[key];
  calls.executed = [];
  vscode.window.activeTextEditor = undefined;
});

describe('extension activation', () => {
  it('registers the custom editor and open command', () => {
    const context = { extensionUri: 'extension', subscriptions: [] };
    extension.activate(context);

    assert.equal(calls.providerRegistration[0], extension.viewType);
    assert.ok(calls.providerRegistration[1] instanceof extension.PipelineEditorProvider);
    assert.deepEqual(calls.providerRegistration[2], {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    });
    assert.equal(calls.command.name, 'biztalkPipeline.openViewer');
    assert.equal(context.subscriptions.length, 2);
  });

  it('opens an explicit URI, then falls back to the active editor', async () => {
    extension.activate({ extensionUri: 'extension', subscriptions: [] });

    await calls.command.handler('explicit-uri');
    vscode.window.activeTextEditor = { document: { uri: 'active-uri' } };
    await calls.command.handler();

    assert.deepEqual(calls.executed, [
      ['vscode.openWith', 'explicit-uri', extension.viewType],
      ['vscode.openWith', 'active-uri', extension.viewType],
    ]);
  });

  it('does nothing when there is no document to open', () => {
    extension.activate({ extensionUri: 'extension', subscriptions: [] });
    assert.equal(calls.command.handler(), undefined);
    assert.deepEqual(calls.executed, []);
  });
});

describe('PipelineEditorProvider', () => {
  function createEditor() {
    const document = {
      fileName: path.join('pipelines', 'Receive.btp'),
      getText: () => '<Document />',
      uri: { toString: () => 'file:///Receive.btp' },
    };
    const webview = {
      asWebviewUri: (uri) => `webview:${uri}`,
      cspSource: 'webview-source',
      onDidReceiveMessage: (handler) => {
        calls.messageHandler = handler;
        return { dispose: () => { calls.messageDisposed = true; } };
      },
      postMessage: (message) => {
        calls.messages = [...(calls.messages || []), message];
        return Promise.resolve(true);
      },
    };
    const panel = {
      webview,
      onDidDispose: (handler) => { calls.disposeHandler = handler; },
    };
    return { document, panel, webview };
  }

  it('configures the webview and sends matching document updates', () => {
    const provider = new extension.PipelineEditorProvider({ extensionUri: 'extension' });
    const { document, panel, webview } = createEditor();
    provider.resolveCustomTextEditor(document, panel);

    assert.deepEqual(webview.options, {
      enableScripts: true,
      localResourceRoots: ['extension/media'],
    });
    assert.match(webview.html, /Content-Security-Policy/);
    assert.match(webview.html, /webview:extension\/media\/main\.js/);

    calls.messageHandler({ type: 'ready' });
    calls.documentHandler({ document: { uri: { toString: () => 'file:///other.btp' } } });
    calls.documentHandler({ document });

    assert.deepEqual(calls.messages, [
      { type: 'document', fileName: 'Receive.btp', text: '<Document />' },
      { type: 'document', fileName: 'Receive.btp', text: '<Document />' },
    ]);
  });

  it('opens the source as text and disposes event subscriptions', () => {
    const provider = new extension.PipelineEditorProvider({ extensionUri: 'extension' });
    const { document, panel } = createEditor();
    provider.resolveCustomTextEditor(document, panel);

    calls.messageHandler({ type: 'openText' });
    assert.deepEqual(calls.executed, [['vscode.openWith', document.uri, 'default']]);

    calls.disposeHandler();
    assert.equal(calls.documentDisposed, true);
    assert.equal(calls.messageDisposed, true);
  });
});

describe('createNonce', () => {
  it('creates 32-character alphanumeric nonces', () => {
    const nonce = extension.createNonce();
    assert.match(nonce, /^[A-Za-z0-9]{32}$/);
    assert.notEqual(nonce, extension.createNonce());
  });
});
