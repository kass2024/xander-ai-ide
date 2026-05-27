/**
 * Monaco workers must use getWorkerUrl (not Worker constructor) for Electron file:// + asar.
 */
import editorWorkerUrl from 'monaco-editor/esm/vs/editor/editor.worker?url';
import jsonWorkerUrl from 'monaco-editor/esm/vs/language/json/json.worker?url';
import cssWorkerUrl from 'monaco-editor/esm/vs/language/css/css.worker?url';
import htmlWorkerUrl from 'monaco-editor/esm/vs/language/html/html.worker?url';
import tsWorkerUrl from 'monaco-editor/esm/vs/language/typescript/ts.worker?url';

let configured = false;

export function setupMonacoEnvironment() {
  if (configured) return;
  configured = true;

  const env = self as typeof self & { MonacoEnvironment?: { getWorkerUrl?: (id: string, label: string) => string } };
  env.MonacoEnvironment = {
    getWorkerUrl(_workerId: string, label: string) {
      switch (label) {
        case 'json':
          return jsonWorkerUrl;
        case 'css':
        case 'scss':
        case 'less':
          return cssWorkerUrl;
        case 'html':
        case 'handlebars':
        case 'razor':
          return htmlWorkerUrl;
        case 'typescript':
        case 'javascript':
          return tsWorkerUrl;
        default:
          return editorWorkerUrl;
      }
    },
  };
}
