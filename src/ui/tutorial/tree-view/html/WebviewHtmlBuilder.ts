import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { err, ok, Result } from 'neverthrow';
import { WEBVIEW_FOLDER, BUILD_FOLDER, ROOT_HTML } from '../const';

type Error = string;

export class WebviewHtmlBuilder {
  static getHtmlContent(webview: vscode.Webview, extensionUri: vscode.Uri): Result<string, Error> {
    const svelteAppBuildPath = vscode.Uri.joinPath(extensionUri, WEBVIEW_FOLDER, BUILD_FOLDER);
    const svelteAppDiskPath = svelteAppBuildPath.fsPath;
    const indexHtmlPath = path.join(svelteAppDiskPath, ROOT_HTML);

    let htmlContent: string;
    try {
      htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
    } catch (e) {
      console.error(`Error reading sidebar.html from ${indexHtmlPath}: ${e}`);
      return err(`<!DOCTYPE html><html><body>Error loading webview content. Details: ${e}</body></html>`);
    }

    // Find asset paths using regex
    const cssRegex = /<link[^>]*?href="([^"\>]*?\.css)"/;
    const cssMatch = htmlContent.match(cssRegex);
    const relativeCssPath = cssMatch ? cssMatch[1] : null;

    const jsRegex = /<script[^>]*?src="([^"\>]*?\.js)"/;
    const jsMatch = htmlContent.match(jsRegex);
    const relativeJsPath = jsMatch ? jsMatch[1] : null;

    if (!relativeCssPath || !relativeJsPath) {
      console.error('Could not extract CSS or JS paths from sidebar.html');
      return err(`<!DOCTYPE html><html><body>Error parsing ${ROOT_HTML}</body></html>`);
    }

    // Create webview URIs
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(svelteAppBuildPath, relativeCssPath));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(svelteAppBuildPath, relativeJsPath));

    const nonce = this.getNonce();
    const csp = `default-src 'none'; style-src ${webview.cspSource} https://microsoft.github.io 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} https://microsoft.github.io;`;

    // Remove original tags
    htmlContent = htmlContent.replace(/<script.*?src=".*?"[^>]*><\/script>/g, '');
    htmlContent = htmlContent.replace(/<link rel="stylesheet".*?href=".*?"[^>]*>/g, '');

    // Inject with webview URIs
    htmlContent = htmlContent.replace(
      '</head>',
      `  <meta http-equiv="Content-Security-Policy" content="${csp}">\n` +
        `  <link rel="stylesheet" type="text/css" href="${cssUri}">\n` +
        `  <link rel="stylesheet" href="https://microsoft.github.io/vscode-codicons/dist/codicon.css">\n` +
        '</head>'
    );
    htmlContent = htmlContent.replace(
      '</body>',
      `  <script defer type="module" nonce="${nonce}" src="${jsUri}"></script>\n` + '</body>'
    );

    return ok(htmlContent);
  }
  /**
   * Generate a nonce for Content Security Policy
   */
  private static getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}

export { Error as WebviewHtmlBuilderError };
