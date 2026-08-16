'use strict';

const vscode = acquireVsCodeApi();
const app = document.getElementById('app');

const stageNames = new Map([
  ['9d0e4103-4cce-4536-83fa-4a5040674ad6', 'Decode'],
  ['9d0e4105-4cce-4536-83fa-4a5040674ad6', 'Disassemble'],
  ['9d0e410d-4cce-4536-83fa-4a5040674ad6', 'Validate'],
  ['9d0e410e-4cce-4536-83fa-4a5040674ad6', 'Resolve Party'],
  ['9d0e4101-4cce-4536-83fa-4a5040674ad6', 'Pre-assemble'],
  ['9d0e4107-4cce-4536-83fa-4a5040674ad6', 'Assemble'],
  ['9d0e4108-4cce-4536-83fa-4a5040674ad6', 'Encode'],
]);

window.addEventListener('message', (event) => {
  if (event.data?.type !== 'document') return;
  render(event.data.fileName, event.data.text);
});

function render(fileName, source) {
  try {
    const model = parsePipeline(fileName, source);
    app.replaceChildren(buildViewer(model));
  } catch (error) {
    const box = element('div', 'error');
    box.append(element('h2', '', 'Unable to read pipeline'), element('p', '', error instanceof Error ? error.message : String(error)));
    app.replaceChildren(box);
  }
}

function parsePipeline(fileName, source) {
  const firstMarkup = source.search(/<[!?A-Za-z_]/);
  const xml = new DOMParser().parseFromString(firstMarkup > 0 ? source.slice(firstMarkup) : source, 'application/xml');
  const parseError = xml.querySelector('parsererror');
  if (parseError) throw new Error('The .btp file is not valid XML.');
  const root = xml.documentElement;
  if (root.localName !== 'Document') throw new Error('This XML does not look like a BizTalk pipeline document.');

  const policy = root.getAttribute('PolicyFilePath') || '';
  const direction = /receive/i.test(policy) ? 'Receive' : /transmit|send/i.test(policy) ? 'Send' : 'Pipeline';
  const stages = Array.from(root.querySelectorAll(':scope > Stages > Stage')).map((stage, index) => {
    const categoryId = (stage.getAttribute('CategoryId') || '').toLowerCase();
    const components = Array.from(stage.querySelectorAll(':scope > Components > Component')).map((component) => ({
      name: text(component, 'ComponentName') || text(component, 'CachedDisplayName') || text(component, 'Name') || 'Unnamed component',
      type: text(component, 'Name'),
      description: text(component, 'Description'),
      version: text(component, 'Version'),
      managed: text(component, 'CachedIsManaged'),
      properties: Array.from(component.querySelectorAll(':scope > Properties > Property')).map((property) => ({
        name: property.getAttribute('Name') || 'Property',
        value: text(property, 'Value'),
        type: property.querySelector(':scope > Value')?.getAttributeNS('http://www.w3.org/2001/XMLSchema-instance', 'type') || '',
      })),
    }));
    return { categoryId, name: stageNames.get(categoryId) || `Stage ${index + 1}`, components };
  });

  return {
    fileName,
    direction,
    policy,
    version: `${root.getAttribute('MajorVersion') || '1'}.${root.getAttribute('MinorVersion') || '0'}`,
    stages,
  };
}

function buildViewer(model) {
  const page = element('main', 'page');
  const header = element('header', 'header');
  const heading = element('div');
  heading.append(element('div', 'eyebrow', `${model.direction} pipeline · v${model.version}`), element('h1', '', model.fileName), element('p', 'policy', model.policy || 'No policy file recorded'));
  const textButton = element('button', 'text-button', 'Open as text');
  textButton.addEventListener('click', () => vscode.postMessage({ type: 'openText' }));
  header.append(heading, textButton);

  const summary = element('div', 'summary');
  const componentCount = model.stages.reduce((total, stage) => total + stage.components.length, 0);
  summary.append(stat(model.stages.length, 'Stages'), stat(componentCount, 'Components'), stat(model.direction, 'Direction'));

  const flow = element('section', 'flow');
  model.stages.forEach((stage, stageIndex) => {
    const stageElement = element('article', 'stage');
    const stageHeader = element('div', 'stage-header');
    stageHeader.append(element('span', 'stage-number', String(stageIndex + 1)), element('h2', '', stage.name), element('span', 'count', `${stage.components.length} component${stage.components.length === 1 ? '' : 's'}`));
    stageElement.append(stageHeader);

    const components = element('div', 'components');
    if (!stage.components.length) components.append(element('div', 'empty', 'No components'));
    stage.components.forEach((component) => components.append(buildComponent(component)));
    stageElement.append(components, element('code', 'category', stage.categoryId));
    flow.append(stageElement);
    if (stageIndex < model.stages.length - 1) flow.append(element('div', 'arrow', '↓'));
  });

  page.append(header, summary, flow);
  return page;
}

function buildComponent(component) {
  const card = element('details', 'component');
  card.open = true;
  const title = element('summary');
  const titleText = element('div');
  titleText.append(element('strong', '', component.name), element('code', '', component.type));
  title.append(titleText, element('span', 'chevron', '⌄'));
  card.append(title);
  const body = element('div', 'component-body');
  if (component.description) body.append(element('p', 'description', component.description));
  const metadata = element('div', 'metadata');
  if (component.version) metadata.append(element('span', '', `Version ${component.version}`));
  if (component.managed) metadata.append(element('span', '', `Managed: ${component.managed}`));
  body.append(metadata);

  if (component.properties.length) {
    const table = element('table');
    const tbody = element('tbody');
    component.properties.forEach((property) => {
      const row = element('tr');
      row.append(element('th', '', property.name), element('td', property.value ? '' : 'unset', property.value || 'Not set'));
      tbody.append(row);
    });
    table.append(tbody);
    body.append(table);
  } else {
    body.append(element('p', 'empty-property', 'No configured properties'));
  }
  card.append(body);
  return card;
}

function stat(value, label) {
  const item = element('div', 'stat');
  item.append(element('strong', '', String(value)), element('span', '', label));
  return item;
}

function text(parent, selector) {
  return parent.querySelector(`:scope > ${selector}`)?.textContent?.trim() || '';
}

function element(tag, className = '', textContent = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent) node.textContent = textContent;
  return node;
}

vscode.postMessage({ type: 'ready' });
