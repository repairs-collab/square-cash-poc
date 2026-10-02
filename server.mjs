import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

function decodeRequestPath(pathname) {
  let decoded = decodeURIComponent(pathname);
  if (/%[0-9A-Fa-f]{2}/.test(decoded)) {
    decoded = decodeURIComponent(decoded);
  }
  return decoded.replaceAll("\\", "/");
}

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(message);
}

export function createStaticServer({ rootDirectory }) {
  const resolvedRoot = path.resolve(rootDirectory);

  return createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendText(response, 405, "Method not allowed");
      return;
    }

    let relativePath;
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const decodedPath = decodeRequestPath(requestUrl.pathname);
      relativePath = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
    } catch {
      sendText(response, 400, "Invalid request path");
      return;
    }

    if (!relativePath || relativePath.split("/").includes("..")) {
      sendText(response, 400, "Invalid request path");
      return;
    }

    const filePath = path.resolve(resolvedRoot, relativePath);
    if (filePath !== resolvedRoot && !filePath.startsWith(`${resolvedRoot}${path.sep}`)) {
      sendText(response, 400, "Invalid request path");
      return;
    }

    let contents;
    try {
      contents = await readFile(filePath);
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "EISDIR") {
        sendText(response, 404, "Not found");
        return;
      }
      sendText(response, 500, "Unable to read file");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const noStore = relativePath === "callback.html" || relativePath === "callback.js";
    response.writeHead(200, {
      "Content-Type": contentTypes.get(extension) ?? "application/octet-stream",
      "Cache-Control": noStore ? "no-store" : "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  });
}

const currentFile = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;

if (isDirectRun) {
  const rootDirectory = path.join(path.dirname(currentFile), "site");
  const server = createStaticServer({ rootDirectory });
  server.listen(8787, "127.0.0.1", () => {
    console.log("Square Cash Test is available at http://127.0.0.1:8787/");
    console.log("Press Ctrl+C to stop the local server.");
  });
}
