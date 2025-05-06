// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import "@hotwired/turbo-rails"
import "controllers"

// Monaco editor theme definition
// Define the theme immediately when this file loads
const PRIMETA_THEME = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '8596A6', fontStyle: 'italic' },
    { token: 'keyword', foreground: '56A8F5' },  // Brighter blue for better visibility
    { token: 'string', foreground: 'F5D76E' },   // Brighter yellow for strings
    { token: 'number', foreground: 'C3E88D' },   // Lime green for numbers
    { token: 'operator', foreground: 'F8F8F2' }, // Bright white for operators
    { token: 'type', foreground: '72E0D1' },     // Teal for types
    { token: 'function', foreground: 'FFCB6B' }, // Gold for functions
    { token: 'variable', foreground: '9CDCFE' }, // Light blue for variables
    { token: 'parameter', foreground: 'A6E3FF' },// Lighter blue for parameters
    { token: 'class', foreground: '72E0D1' },    // Teal for classes
    { token: 'interface', foreground: '72E0D1' },// Teal for interfaces
    { token: 'tag', foreground: '56A8F5' },      // Bright blue for tags
    { token: 'regexp', foreground: 'FF8A80' },   // Coral for regex
    { token: 'property', foreground: 'A6E3FF' }, // Light blue for properties
    { token: 'constant', foreground: 'FF6B94' }, // Pink for constants
  ],
  colors: {
    // UI colors - deeper background with better contrast
    'editor.background': '#0A0A23',         // Dark Navy Background
    'editor.foreground': '#F8F8F2',         // Brighter white for text
    'editorCursor.foreground': '#56A8F5',   // Brighter blue for cursor
    'editor.lineHighlightBackground': '#1E2A4A', // Slightly blue highlight
    'editorLineNumber.foreground': '#858585',
    'editorLineNumber.activeForeground': '#C7C7C7', // Brighter active line number
    'editor.selectionBackground': '#264F7899', // Semi-transparent selection
    'editor.inactiveSelectionBackground': '#3A3D5199',
    'editor.findMatchBackground': '#FFCB6B55', // Highlighted search matches
    'editor.findMatchHighlightBackground': '#FFCB6B33',
    'editorIndentGuide.background': '#404054',
    'editorIndentGuide.activeBackground': '#707088',
    'editorGutter.background': '#0A0A23',
    'scrollbarSlider.background': 'rgba(53, 85, 143, 0.4)',      // Muted blue scrollbar
    'scrollbarSlider.hoverBackground': 'rgba(73, 125, 189, 0.6)', // Brighter blue on hover
    'scrollbarSlider.activeBackground': 'rgba(86, 168, 245, 0.5)', // Match cursor blue when active
    'editorBracketMatch.border': '#56A8F5',
    'editorBracketMatch.background': '#56A8F522',
  }
};

// Define the theme as soon as Monaco is available
function defineMonacoTheme() {
  if (!window.monaco) return;
  window.monaco.editor.defineTheme('primeta-dark', PRIMETA_THEME);
}

// Predefined function to be called from controllers
window.applyPrimetaTheme = function() {
  if (window.monaco) {
    defineMonacoTheme();
    return true;
  }
  return false;
};

// Start checking for Monaco immediately
(function() {
  // Initial check
  if (window.monaco) {
    defineMonacoTheme();
  }
  
  // Set up a small interval to keep checking
  const checkMonaco = setInterval(() => {
    if (window.monaco) {
      defineMonacoTheme();
      clearInterval(checkMonaco);
      console.log("Primeta theme defined successfully");
    }
  }, 50); // Check more frequently
  
  // Don't check indefinitely
  setTimeout(() => clearInterval(checkMonaco), 10000);
  
  // Also check when the DOM is fully loaded
  document.addEventListener('DOMContentLoaded', () => {
    defineMonacoTheme();
  });
  
  // And when the window is fully loaded
  window.addEventListener('load', () => {
    defineMonacoTheme();
  });
})();
