// Inline Code Highlighter for Manual Code Pasting
// Automatically formats and highlights code in HTML elements with support for multiple languages

class InlineCodeHighlighter {
  constructor() {
    // Language configuration and display names
    this.languageConfig = {
      python: {
        language: "python",
        displayName: "Python",
        keywords: [
          "False",
          "None",
          "True",
          "and",
          "as",
          "assert",
          "async",
          "await",
          "break",
          "class",
          "continue",
          "def",
          "del",
          "elif",
          "else",
          "except",
          "finally",
          "for",
          "from",
          "global",
          "if",
          "import",
          "in",
          "is",
          "lambda",
          "nonlocal",
          "not",
          "or",
          "pass",
          "raise",
          "return",
          "try",
          "while",
          "with",
          "yield",
        ],
        builtins: [
          "abs",
          "all",
          "any",
          "ascii",
          "bin",
          "bool",
          "breakpoint",
          "bytearray",
          "bytes",
          "callable",
          "chr",
          "classmethod",
          "compile",
          "complex",
          "delattr",
          "dict",
          "dir",
          "divmod",
          "enumerate",
          "eval",
          "exec",
          "filter",
          "float",
          "format",
          "frozenset",
          "getattr",
          "globals",
          "hasattr",
          "hash",
          "help",
          "hex",
          "id",
          "input",
          "int",
          "isinstance",
          "issubclass",
          "iter",
          "len",
          "list",
          "locals",
          "map",
          "max",
          "memoryview",
          "min",
          "next",
          "object",
          "oct",
          "open",
          "ord",
          "pow",
          "print",
          "property",
          "range",
          "repr",
          "reversed",
          "round",
          "set",
          "setattr",
          "slice",
          "sorted",
          "staticmethod",
          "str",
          "sum",
          "super",
          "tuple",
          "type",
          "vars",
          "zip",
        ],
        commentChar: "#",
        stringRegex: /(f?"[^"]*"|f?'[^']*')/g,
        decoratorRegex: true,
        classRegex: /\bclass\s+(\w+)/g,
        functionRegex: /\b(\w+)\s*\(/g,
      },
      javascript: {
        language: "javascript",
        displayName: "JavaScript",
        keywords: [
          "break",
          "case",
          "catch",
          "class",
          "const",
          "continue",
          "debugger",
          "default",
          "delete",
          "do",
          "else",
          "export",
          "extends",
          "finally",
          "for",
          "function",
          "if",
          "import",
          "in",
          "instanceof",
          "let",
          "new",
          "return",
          "super",
          "switch",
          "this",
          "throw",
          "try",
          "typeof",
          "var",
          "void",
          "while",
          "with",
          "yield",
          "async",
          "await",
        ],
        builtins: [
          "Array",
          "Boolean",
          "Date",
          "Error",
          "Function",
          "JSON",
          "Math",
          "Number",
          "Object",
          "RegExp",
          "String",
          "Promise",
          "Proxy",
          "Map",
          "Set",
          "WeakMap",
          "WeakSet",
          "Symbol",
          "BigInt",
          "console",
          "parseInt",
          "parseFloat",
          "isNaN",
          "isFinite",
          "undefined",
          "null",
        ],
        commentChar: "//",
        stringRegex: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
        classRegex: /\bclass\s+(\w+)/g,
        functionRegex:
          /\b(?:function\s+(\w+)|(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>)|\b(\w+)\s*\()/g,
      },
      bash: {
        language: "bash",
        displayName: "Bash",
        keywords: [
          "if",
          "then",
          "else",
          "elif",
          "fi",
          "case",
          "esac",
          "for",
          "while",
          "until",
          "do",
          "done",
          "in",
          "function",
          "time",
          "select",
          "break",
          "continue",
          "return",
          "exit",
        ],
        builtins: [
          "echo",
          "printf",
          "read",
          "cd",
          "pwd",
          "pushd",
          "popd",
          "export",
          "unset",
          "eval",
          "source",
          "alias",
          "unalias",
          "umask",
          "test",
          "true",
          "false",
          "local",
          "shift",
          "getopts",
          "exec",
          "trap",
        ],
        commentChar: "#",
        stringRegex: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
        functionRegex: /\b(\w+)\s*\(\)/g,
      },
      cpp: {
        language: "cpp",
        displayName: "C++",
        keywords: [
          "auto",
          "break",
          "case",
          "catch",
          "class",
          "const",
          "continue",
          "default",
          "delete",
          "do",
          "else",
          "enum",
          "explicit",
          "export",
          "extern",
          "for",
          "friend",
          "goto",
          "if",
          "inline",
          "namespace",
          "new",
          "operator",
          "private",
          "protected",
          "public",
          "return",
          "sizeof",
          "static",
          "struct",
          "switch",
          "template",
          "this",
          "throw",
          "try",
          "typedef",
          "typename",
          "union",
          "using",
          "virtual",
          "while",
        ],
        builtins: [
          "bool",
          "char",
          "double",
          "float",
          "int",
          "long",
          "short",
          "signed",
          "unsigned",
          "void",
          "wchar_t",
          "size_t",
          "nullptr",
          "true",
          "false",
          "cout",
          "cin",
          "endl",
          "string",
          "vector",
        ],
        commentChar: "//",
        stringRegex: /("(?:[^"\\]|\\.)*")/g,
        classRegex: /\bclass\s+(\w+)/g,
        functionRegex: /\b(\w+)\s*\(/g,
      },
      java: {
        language: "java",
        displayName: "Java",
        keywords: [
          "abstract",
          "assert",
          "boolean",
          "break",
          "byte",
          "case",
          "catch",
          "char",
          "class",
          "const",
          "continue",
          "default",
          "do",
          "double",
          "else",
          "enum",
          "extends",
          "final",
          "finally",
          "float",
          "for",
          "if",
          "implements",
          "import",
          "instanceof",
          "int",
          "interface",
          "long",
          "native",
          "new",
          "package",
          "private",
          "protected",
          "public",
          "return",
          "short",
          "static",
          "strictfp",
          "super",
          "switch",
          "synchronized",
          "this",
          "throw",
          "throws",
          "transient",
          "try",
          "void",
          "volatile",
          "while",
        ],
        builtins: [
          "String",
          "System",
          "Object",
          "Class",
          "Throwable",
          "Exception",
          "Error",
          "RuntimeException",
          "Thread",
          "Runnable",
          "Integer",
          "Double",
          "Boolean",
          "Byte",
          "Character",
          "Float",
          "Long",
          "Short",
          "Void",
        ],
        commentChar: "//",
        stringRegex: /("(?:[^"\\]|\\.)*")/g,
        classRegex: /\bclass\s+(\w+)/g,
        functionRegex: /\b(\w+)\s*\(/g,
      },
      json: {
        language: "json",
        displayName: "JSON",
        keywords: ["true", "false", "null"],
        builtins: [],
        stringRegex: null, // Будем обрабатывать строки отдельно
        numberRegex: /-?\b\d+\.?\d*(?:[eE][+-]?\d+)?\b/g,
      },
    };

    this.init();
  }

  init() {
    // Process all code blocks on page load
    this.processAllCodeBlocks();

    // Watch for new elements added dynamically
    this.observeDOMChanges();
  }

  processAllCodeBlocks() {
    // Find all elements with the 'code-block' class
    const codeBlocks = document.querySelectorAll(".code-block");
    codeBlocks.forEach((block) => this.processCodeBlock(block));
  }

  processCodeBlock(element) {
    // Уже обработанный блок: info-cards.js переносит его в карточку, observer
    // видит его снова, и повторный проход вклеивал «Python Copy» и номера
    // строк внутрь кода.
    if (element.querySelector(".code-container")) return;

    // Get the original text content
    let originalCode = element.textContent || element.innerText;

    // Trim empty lines from the beginning and end
    originalCode = this.trimEmptyLines(originalCode);

    // Detect language from data-lang attribute, default to Python
    const detectedLanguage = this.detectLanguage(element);

    // Create the IDE-style container
    const container = this.createCodeContainer(originalCode, detectedLanguage);

    // Replace the original content
    element.innerHTML = "";
    element.appendChild(container);

    // Add line numbers first
    this.addLineNumbers(container, originalCode);

    // Then apply syntax highlighting
    this.highlightCode(container, detectedLanguage);

    // Add copy button
    this.addCopyButton(container, originalCode);
  }

  trimEmptyLines(code) {
    if (!code) return code;

    // Split into lines
    const lines = code.split("\n");

    // Find first non-empty line from the beginning
    let startIndex = 0;
    while (startIndex < lines.length && lines[startIndex].trim() === "") {
      startIndex++;
    }

    // Find last non-empty line from the end
    let endIndex = lines.length - 1;
    while (endIndex >= startIndex && lines[endIndex].trim() === "") {
      endIndex--;
    }

    // If all lines are empty, return empty string
    if (startIndex > endIndex) {
      return "";
    }

    // Return trimmed code
    return lines.slice(startIndex, endIndex + 1).join("\n");
  }

  detectLanguage(element) {
    // Get language from data-lang attribute
    const dataLang = element.getAttribute("data-lang");

    // Normalize language name
    const langMap = {
      py: "python",
      js: "javascript",
      ts: "javascript", // Use JavaScript highlighting for TypeScript
      shell: "bash",
      sh: "bash",
      cpp: "cpp",
      "c++": "cpp",
      java: "java",
      json: "json",
    };

    if (dataLang) {
      const normalizedLang = dataLang.toLowerCase();
      // Check if we have a direct mapping
      if (this.languageConfig[normalizedLang]) {
        return normalizedLang;
      }
      // Check if we have an alias mapping
      if (langMap[normalizedLang]) {
        return langMap[normalizedLang];
      }
    }

    // Try to detect language from code content or file extension
    const codeText = element.textContent || "";
    if (codeText.trim().startsWith("<?php")) {
      return "php";
    }
    if (
      codeText.trim().startsWith("<!DOCTYPE html") ||
      codeText.trim().startsWith("<html")
    ) {
      return "html";
    }
    if (
      codeText.trim().startsWith("package ") ||
      codeText.includes("public class ")
    ) {
      return "java";
    }
    if (
      codeText.includes("#!/bin/bash") ||
      codeText.includes("#!/usr/bin/env bash")
    ) {
      return "bash";
    }

    // Default to Python if no valid language is detected
    return "python";
  }

  getLanguageDisplayName(language) {
    return this.languageConfig[language]?.displayName || "Unknown";
  }

  createCodeContainer(code, language) {
    const container = document.createElement("div");
    container.className = "code-container";

    // Get the display name for the language
    const languageDisplayName = this.getLanguageDisplayName(language);

    // Create header
    const header = document.createElement("div");
    header.className = "code-header";
    header.innerHTML = `
            <div class="code-language">${languageDisplayName}</div>
            <div class="code-actions">
                <button class="code-action-btn copy-btn" title="Copy code">Copy</button>
            </div>
        `;

    // Create content area
    const content = document.createElement("div");
    content.className = "code-content";

    // Create line numbers container
    const lineNumbers = document.createElement("div");
    lineNumbers.className = "line-numbers";

    // Create code text container
    const codeText = document.createElement("div");
    codeText.className = "code-text";
    codeText.textContent = code;

    // Assemble the container
    content.appendChild(lineNumbers);
    content.appendChild(codeText);
    container.appendChild(header);
    container.appendChild(content);

    return container;
  }

  addLineNumbers(container, originalCode) {
    const codeText = container.querySelector(".code-text");
    const lineNumbers = container.querySelector(".line-numbers");

    // Удаляем все старые номера
    lineNumbers.innerHTML = "";

    // Разбиваем исходный код на строки
    const lines = originalCode.split("\n");

    // Если последняя строка пустая, добавляем её для правильной нумерации
    if (originalCode.endsWith("\n")) {
      lines.push("");
    }

    // Создаём отдельный элемент для каждой строки
    lines.forEach((_, index) => {
      const lineElem = document.createElement("div");
      lineElem.textContent = String(index + 1).padStart(3);
      lineNumbers.appendChild(lineElem);
    });
  }

  highlightCode(container, language) {
    const codeText = container.querySelector(".code-text");
    const originalCode = codeText.textContent;

    // Get language configuration
    const langConfig = this.languageConfig[language];

    if (!langConfig) {
      // If no configuration exists, treat as plain text
      return;
    }

    // Split into lines and process each line
    const lines = originalCode.split("\n");
    const processedLines = lines.map((line) =>
      this.processLine(line, langConfig),
    );

    // Join lines back together and set as HTML
    codeText.innerHTML = processedLines.join("\n");
  }

  processLine(line, langConfig) {
    // Skip empty lines
    if (line.trim() === "") {
      return line;
    }

    // Check if line contains a comment (if language supports comments)
    if (langConfig.commentChar) {
      const commentIndex = line.indexOf(langConfig.commentChar);
      if (commentIndex !== -1) {
        const codePart = line.substring(0, commentIndex);
        const commentPart = line.substring(commentIndex);
        return (
          this.highlightCodePart(codePart, langConfig) +
          '<span class="comment">' +
          this.escapeHtml(commentPart) +
          "</span>"
        );
      }
    }

    return this.highlightCodePart(line, langConfig);
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  highlightCodePart(code, langConfig) {
    if (!code || code.trim() === "") {
      return code;
    }

    // Создаем временный элемент для безопасной работы с HTML
    const temp = document.createElement("div");
    temp.textContent = code;
    let processedCode = temp.innerHTML;

    // Создаем массив для хранения строк и их временных маркеров
    const strings = [];
    const stringMarker = "___STRING_MARKER___";
    let stringCounter = 0;

    // Сохраняем строки и заменяем их маркерами
    processedCode = processedCode.replace(
      /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g,
      (match) => {
        const marker = `${stringMarker}${stringCounter}`;
        strings.push(match);
        stringCounter++;
        return marker;
      },
    );

    // Обработка декораторов (для Python)
    if (langConfig.decoratorRegex) {
      processedCode = processedCode.replace(
        /^(\s*)@([\w.]+)/gm,
        (match, space, name) => {
          return `${space}@${name}`;
        },
      );
    }

    // Обработка ключевых слов
    if (langConfig.keywords) {
      const keywordPattern = new RegExp(
        `\\b(${langConfig.keywords.join("|")})\\b`,
        "g",
      );
      processedCode = processedCode.replace(
        keywordPattern,
        '<span class="keyword">$1</span>',
      );
    }

    // Обработка встроенных функций
    if (langConfig.builtins) {
      const builtinPattern = new RegExp(
        `\\b(${langConfig.builtins.join("|")})\\b(?!\\s*=)`,
        "g",
      );
      processedCode = processedCode.replace(
        builtinPattern,
        '<span class="builtin">$1</span>',
      );
    }

    // Обработка чисел
    processedCode = processedCode.replace(
      /\b(\d+(\.\d+)?)\b/g,
      '<span class="number">$1</span>',
    );

    // Обработка определений классов
    if (langConfig.classRegex) {
      processedCode = processedCode.replace(
        /\b(class)\s+(\w+)\b/g,
        '<span class="keyword">$1</span> <span class="class">$2</span>',
      );
    }

    // Обработка определений функций
    if (langConfig.functionRegex) {
      processedCode = processedCode.replace(
        /\b(def)\s+(\w+)\b/g,
        '<span class="keyword">$1</span> <span class="function">$2</span>',
      );
    }

    // Обработка вызовов функций
    processedCode = processedCode.replace(
      /\b(\w+)\s*\(/g,
      (match, funcName) => {
        if (langConfig.keywords && langConfig.keywords.includes(funcName)) {
          return match;
        }
        if (langConfig.builtins && langConfig.builtins.includes(funcName)) {
          return `<span class="builtin">${funcName}</span>(`;
        }
        return `<span class="function">${funcName}</span>(`;
      },
    );

    // Обработка self и cls для Python
    if (langConfig.language === "python") {
      processedCode = processedCode.replace(
        /\b(self|cls)\b/g,
        '<span class="self">$1</span>',
      );
    }

    // Восстанавливаем строки
    strings.forEach((str, i) => {
      const marker = `${stringMarker}${i}`;
      processedCode = processedCode.replace(
        marker,
        `<span class="string">${str}</span>`,
      );
    });

    return processedCode;
  }

  addCopyButton(container, originalCode) {
    const copyBtn = container.querySelector(".copy-btn");
    if (!copyBtn) return;

    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(originalCode).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = "Copy";
        }, 2000);
      });
    });
  }

  observeDOMChanges() {
    // Create a MutationObserver to watch for new code blocks
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Element node
            // Check the added element itself
            if (node.classList && node.classList.contains("code-block")) {
              this.processCodeBlock(node);
            }
            // Check its children
            const codeBlocks = node.querySelectorAll(".code-block");
            codeBlocks.forEach((block) => this.processCodeBlock(block));
          }
        });
      });
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.inlineCodeHighlighter = new InlineCodeHighlighter();
});

// Export global function for processing code blocks in a container
window.processCodeBlocks = function (container = document) {
  if (!window.inlineCodeHighlighter) {
    window.inlineCodeHighlighter = new InlineCodeHighlighter();
  }

  const codeBlocks = container.querySelectorAll(".code-block");
  codeBlocks.forEach((block) => {
    // Check if already processed
    if (
      !block.querySelector(".code-container") &&
      !block.querySelector(".code-header")
    ) {
      window.inlineCodeHighlighter.processCodeBlock(block);
    }
  });
};

// Export for use in modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = InlineCodeHighlighter;
}
