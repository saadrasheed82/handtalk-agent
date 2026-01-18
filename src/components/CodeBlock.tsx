import { useState } from "react";
import { Check, Copy, FileCode } from "lucide-react";

interface CodeBlockProps {
  filename: string;
  code: string;
  language?: string;
}

export function CodeBlock({ filename, code, language = "javascript" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block">
      <div className="code-header">
        <div className="code-filename">
          <FileCode className="w-4 h-4" />
          <span>{filename}</span>
        </div>
        <button
          onClick={handleCopy}
          className="copy-button"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="code-content">
        <code>{code}</code>
      </pre>
    </div>
  );
}
