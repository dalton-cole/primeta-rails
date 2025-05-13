// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import "@hotwired/turbo-rails"
import "controllers"
// import { createConsumer } from "@rails/actioncable" // We will import the consumer from channels/consumer.js
import consumer from "channels/consumer" // Import the consumer from the generated file

// Make consumer globally available if needed by Stimulus controllers
// that don't import it directly. This is a fallback.
// Turbo should pick up the imported 'consumer' on its own.
window.actionCableConsumer = consumer;
console.log("Action Cable consumer instance created and assigned to window.actionCableConsumer.");

// The 'consumer' is now imported from channels/consumer.js
// const consumer = createConsumer() // This line is removed

// Make the consumer available to Turbo
// Defer assignment until DOM is loaded to ensure Turbo is fully initialized
// document.addEventListener('DOMContentLoaded', () => {
//   if (typeof Turbo !== 'undefined') {
//     console.log("Attempting to assign Action Cable consumer (imported from channels/consumer.js)...");
//     let assignedToTurboDotCable = false;

//     // Try standard Turbo.cable first
//     if (Object.isExtensible(Turbo)) {
//       try {
//         Turbo.cable = consumer; // Use the imported consumer
//         console.log("Action Cable consumer assigned to Turbo.cable");
//         assignedToTurboDotCable = true;
//       } catch (e) {
//         console.error("Error assigning to Turbo.cable:", e);
//       }
//     } else {
//       console.warn("Turbo object is not extensible.");
//     }

//     // If Turbo.cable assignment failed or wasn't possible, AND Turbo.session exists,
//     // try assigning to Turbo.session.cable directly.
//     if (!assignedToTurboDotCable && Turbo.session) {
//       console.log("Turbo.cable assignment failed or Turbo was not extensible. Attempting Turbo.session.cable...");
//       if (Object.isExtensible(Turbo.session)) {
//         try {
//           Turbo.session.cable = consumer; // Use the imported consumer
//           console.log("Action Cable consumer assigned to Turbo.session.cable");
//         } catch (e) {
//           console.error("Error assigning to Turbo.session.cable:", e);
//           console.error("Failed to assign to Turbo.session.cable. Falling back to global assignment.");
//           window.actionCableConsumer = consumer; // Use the imported consumer
//           console.log("Action Cable consumer assigned to window.actionCableConsumer as a fallback.");
//         }
//       } else {
//         console.warn("Turbo.session object is not extensible. Falling back to global assignment.");
//         window.actionCableConsumer = consumer; // Use the imported consumer
//         console.log("Action Cable consumer assigned to window.actionCableConsumer due to non-extensible Turbo.session.");
//       }
//     } else if (!assignedToTurboDotCable) {
//       console.error("Turbo.cable assignment failed and Turbo.session not available. Falling back to global assignment.");
//       window.actionCableConsumer = consumer; // Use the imported consumer
//       console.log("Action Cable consumer assigned to window.actionCableConsumer as a fallback.");
//     }

//   } else {
//     console.error("Turbo not loaded on DOMContentLoaded, cannot assign Action Cable consumer.");
//   }
// });

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

// Monaco Editor Global Loader
window.loadMonacoEditor = function(callback) {
  if (window.monaco) {
    // Monaco already loaded, just apply the theme and call callback
    if (typeof window.applyPrimetaTheme === 'function') {
      window.applyPrimetaTheme();
    }
    if (typeof callback === 'function') {
      callback();
    }
    return;
  }
  
  // Check if Monaco is already being loaded by another controller
  if (window.monacoLoading) {
    // Wait for the current loading to complete
    const checkInterval = setInterval(() => {
      if (window.monaco) {
        clearInterval(checkInterval);
        if (typeof window.applyPrimetaTheme === 'function') {
          window.applyPrimetaTheme();
        }
        if (typeof callback === 'function') {
          callback();
        }
      }
    }, 100);
    return;
  }
  
  // Start loading Monaco
  window.monacoLoading = true;
  console.log("Loading Monaco Editor from CDN...");
  
  // Add Monaco loader script
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/min/vs/loader.js';
  script.async = true;
  script.onload = () => {
    window.require.config({
      paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.40.0/min/vs' }
    });
    
    window.require(['vs/editor/editor.main'], () => {
      console.log("Monaco Editor loaded successfully");
      window.monacoLoading = false;
      
      // Apply theme
      if (typeof window.applyPrimetaTheme === 'function') {
        window.applyPrimetaTheme();
      }
      
      // Call the callback if provided
      if (typeof callback === 'function') {
        callback();
      }
    });
  };
  
  document.head.appendChild(script);
};

// Preload Monaco when the page is idle
if (typeof window.requestIdleCallback === 'function') {
  window.requestIdleCallback(() => {
    window.loadMonacoEditor();
  });
} else {
  // Fallback for browsers that don't support requestIdleCallback
  setTimeout(() => {
    window.loadMonacoEditor();
  }, 1000);
}
import "channels"
