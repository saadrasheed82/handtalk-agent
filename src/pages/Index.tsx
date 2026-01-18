import { useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { CodeBlock } from "@/components/CodeBlock";
import { extensionFiles } from "@/data/extensionFiles";
import { 
  Hand, 
  Download, 
  FileCode, 
  CheckCircle2, 
  Camera,
  Zap,
  Shield,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Package,
  Loader2
} from "lucide-react";

const Index = () => {
  const [activeFile, setActiveFile] = useState<string>("manifest.json");
  const [showInstructions, setShowInstructions] = useState(false);
  const [allCopied, setAllCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fileList = Object.keys(extensionFiles);

  const handleCopyAll = async () => {
    const allCode = Object.entries(extensionFiles)
      .map(([name, code]) => `// ========== ${name} ==========\n\n${code}`)
      .join("\n\n\n");
    await navigator.clipboard.writeText(allCode);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      
      // Add all extension files to the ZIP
      Object.entries(extensionFiles).forEach(([filename, content]) => {
        zip.file(filename, content);
      });
      
      // Create icons folder with placeholder SVG icons
      const iconSvg16 = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`;
      const iconSvg48 = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`;
      const iconSvg128 = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`;
      
      zip.folder("icons")?.file("icon16.svg", iconSvg16);
      zip.folder("icons")?.file("icon48.svg", iconSvg48);
      zip.folder("icons")?.file("icon128.svg", iconSvg128);
      
      // Add a README
      const readme = `# Agent-Zero Gesture Control Extension

## Installation

1. Open Chrome and go to chrome://extensions/
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select this folder

## Usage

1. Navigate to http://72.60.104.92:50080/
2. Click the extension icon
3. Toggle "Enable Gesture Control"
4. Allow camera access

## Gestures

- ✋ Open Palm → "Pause current task"
- ✊ Fist → "Stop immediately"
- ✌️ Two Fingers → "Execute the next task"
- 👍 Thumbs Up → "Confirm and proceed"

## Notes

- Confidence threshold: 85%
- Cooldown between commands: 2 seconds
- Only works on Agent-Zero (72.60.104.92:50080)
`;
      zip.file("README.md", readme);
      
      // Generate and download
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, "agent-zero-gesture-extension.zip");
    } catch (error) {
      console.error("Failed to create ZIP:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const gestures = [
    { emoji: "✋", name: "Open Palm", command: "Pause current task" },
    { emoji: "✊", name: "Fist", command: "Stop immediately" },
    { emoji: "✌️", name: "Two Fingers", command: "Execute the next task" },
    { emoji: "👍", name: "Thumbs Up", command: "Confirm and proceed" },
  ];

  const features = [
    { icon: Camera, title: "Webcam Detection", desc: "MediaPipe Hands with 85% confidence" },
    { icon: Zap, title: "Instant Injection", desc: "Commands injected seamlessly" },
    { icon: Shield, title: "Domain Locked", desc: "Only works on Agent-Zero" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-content">
          <div className="hero-icon">
            <Hand className="w-16 h-16" />
          </div>
          <h1 className="hero-title">
            Agent-Zero
            <span className="hero-highlight"> Gesture Control</span>
          </h1>
          <p className="hero-subtitle">
            Chrome Extension for hands-free AI agent control via webcam gestures
          </p>
          <div className="hero-badge">
            <span className="badge-dot" />
            Target: 72.60.104.92:50080
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="features-section">
        <div className="features-grid">
          {features.map((feature, i) => (
            <div key={i} className="feature-card">
              <feature.icon className="feature-icon" />
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gestures */}
      <section className="gestures-section">
        <h2 className="section-title">Gesture Commands</h2>
        <div className="gestures-grid">
          {gestures.map((gesture, i) => (
            <div key={i} className="gesture-card">
              <span className="gesture-emoji">{gesture.emoji}</span>
              <div className="gesture-info">
                <h4>{gesture.name}</h4>
                <p>{gesture.command}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Code Files */}
      <section className="code-section">
        <div className="code-header-main">
          <h2 className="section-title">
            <FileCode className="w-6 h-6" />
            Extension Files
          </h2>
          <div className="code-actions">
            <button onClick={handleDownloadZip} className="download-zip-button" disabled={isDownloading}>
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating ZIP...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Download ZIP
                </>
              )}
            </button>
            <button onClick={handleCopyAll} className="copy-all-button">
              {allCopied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy All
              </>
              )}
            </button>
          </div>
        </div>

        <div className="code-container">
          {/* File Tabs */}
          <div className="file-tabs">
            {fileList.map((file) => (
              <button
                key={file}
                onClick={() => setActiveFile(file)}
                className={`file-tab ${activeFile === file ? "active" : ""}`}
              >
                {file}
              </button>
            ))}
          </div>

          {/* Code Display */}
          <div className="code-display">
            <CodeBlock
              filename={activeFile}
              code={extensionFiles[activeFile as keyof typeof extensionFiles]}
            />
          </div>
        </div>
      </section>

      {/* Installation */}
      <section className="install-section">
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="install-toggle"
        >
          <div className="install-toggle-content">
            <Download className="w-5 h-5" />
            <span>Installation Instructions</span>
          </div>
          {showInstructions ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>

        {showInstructions && (
          <div className="install-content">
            <div className="install-steps">
              <div className="install-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h4>Save the Extension Files</h4>
                  <p>Create a folder called <code>agent-zero-gesture</code> and save each file above into it. Create an <code>icons</code> subfolder with PNG icons (16x16, 48x48, 128x128).</p>
                </div>
              </div>

              <div className="install-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4>Load in Chrome</h4>
                  <p>Open <code>chrome://extensions/</code>, enable <strong>Developer mode</strong>, click <strong>Load unpacked</strong>, and select the folder.</p>
                </div>
              </div>

              <div className="install-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h4>Enable Gesture Control</h4>
                  <p>Navigate to <code>http://72.60.104.92:50080/</code>, click the extension icon, toggle on gesture control, and allow camera access.</p>
                </div>
              </div>

              <div className="install-step">
                <div className="step-number">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="step-content">
                  <h4>Test Your Gestures</h4>
                  <p>Show gestures to your webcam. Commands will be injected automatically with a 2-second cooldown between actions.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>Built for Agent-Zero • MediaPipe Hands • Manifest V3</p>
      </footer>
    </div>
  );
};

export default Index;
