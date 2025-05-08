# Primeta.ai Style Guide

This style guide defines the visual language for Primeta.ai to ensure consistency across the platform. The design system is based on the AI assistant component's aesthetics with modern gradients, subtle animations, and a cohesive color scheme.

## Color System

### Primary Palette

| Color Name | Hex Value | Usage |
|------------|-----------|-------|
| Primary Purple | `#6366F1` | Primary actions, active states, focus indicators |
| Primary Dark Purple | `#4F46E5` | Gradient start color, hover states |
| Primary Light Purple | `#A78BFA` | Headings, highlights, secondary elements |
| Accent Purple | `#7C3AED` | Gradient end color, accent elements |

### Secondary Palette

| Color Name | Hex Value | Usage |
|------------|-----------|-------|
| Navy Dark | `#0F172A` | Background gradient start |
| Navy Medium | `#1E293B` | Background gradient end, card backgrounds |
| Deep Purple | `#1E1E38` | Tab backgrounds, secondary containers |
| Rich Purple | `#2D1E69` | Header backgrounds, gradient ends |

### Text Colors

| Color Name | Value | Usage |
|------------|-------|-------|
| Text Primary | `#F8F8F2` | Primary text, titles |
| Text Secondary | `rgba(255, 255, 255, 0.9)` | Body text |
| Text Tertiary | `rgba(255, 255, 255, 0.7)` | Secondary text, labels |
| Text Muted | `rgba(255, 255, 255, 0.6)` | Placeholders, hints |
| Text Accent | `#A5B4FC` | Code text, links, special elements |
| Text Headers | `#A78BFA` | Section headings |

### Gradients

```css
/* Primary Gradient (Buttons, CTAs) */
background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);

/* Header Gradient */
background: linear-gradient(90deg, #1E1E38 0%, #2D1E69 100%);

/* Background Gradient (Cards, Panels) */
background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
```

### Shadows

```css
/* Default Shadow */
box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);

/* Elevated Shadow (Hover states) */
box-shadow: 0 14px 36px rgba(0, 0, 0, 0.5), 0 4px 10px rgba(0, 0, 0, 0.3);

/* Button Shadow */
box-shadow: 0 8px 16px rgba(67, 56, 202, 0.3);

/* Button Hover Shadow */
box-shadow: 0 12px 20px rgba(67, 56, 202, 0.4);
```

## Typography

### Font Families

```css
/* Main Font */
font-family: 'Inter', sans-serif;

/* Code Font */
font-family: 'Fira Code', monospace;

/* Optional Header Font */
font-family: 'Sora', sans-serif;
```

### Font Sizes

| Name | Size | Usage |
|------|------|-------|
| xs | 13px | Code text, small labels |
| sm | 14px | Body text, secondary text |
| md | 16px | Headers, buttons |
| lg | 18px | Section headers |
| xl | 20px | Main headers |

### Font Weights

| Weight | Usage |
|--------|-------|
| 400 | Regular text, body copy |
| 500 | Medium emphasis, tab text |
| 600 | Semi-bold, buttons, headings |

## Component Styles

### Buttons

```css
.primeta-button {
  padding: 8px 16px;
  background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);
  color: white;
  border-radius: 50px;
  border: none;
  box-shadow: 0 8px 16px rgba(67, 56, 202, 0.3);
  font-weight: 600;
  font-size: 16px;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
  overflow: hidden;
}

.primeta-button:hover {
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 12px 20px rgba(67, 56, 202, 0.4);
}

/* Shine effect on hover */
.primeta-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, 
    rgba(255, 255, 255, 0) 0%, 
    rgba(255, 255, 255, 0.2) 50%, 
    rgba(255, 255, 255, 0) 100%);
  transition: left 0.6s;
  z-index: 1;
}

.primeta-button:hover::before {
  left: 100%;
}
```

#### Button Variations

**Secondary Button**
```css
.primeta-button-secondary {
  background: rgba(99, 102, 241, 0.1);
  color: #A5B4FC;
  border: 1px solid rgba(99, 102, 241, 0.3);
}

.primeta-button-secondary:hover {
  background: rgba(99, 102, 241, 0.2);
  border-color: rgba(99, 102, 241, 0.5);
}
```

**Small Button**
```css
.primeta-button-sm {
  padding: 6px 12px;
  font-size: 14px;
}
```

### Cards

```css
.primeta-card {
  background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(99, 102, 241, 0.2);
  backdrop-filter: blur(5px);
  padding: 20px;
  color: rgba(255, 255, 255, 0.9);
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.primeta-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.5), 0 4px 10px rgba(0, 0, 0, 0.3);
  border-color: rgba(99, 102, 241, 0.4);
}

.primeta-card-header {
  background: linear-gradient(90deg, #1E1E38 0%, #2D1E69 100%);
  padding: 14px 16px;
  border-bottom: 1px solid rgba(99, 102, 241, 0.3);
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  border-radius: 16px 16px 0 0;
  margin: -20px -20px 20px -20px;
}
```

### Tabs

```css
.primeta-tabs {
  display: flex;
  background: linear-gradient(90deg, #1a1a38 0%, #23204d 100%);
  border-bottom: 1px solid rgba(99, 102, 241, 0.3);
}

.primeta-tab {
  padding: 10px 12px;
  cursor: pointer;
  flex: 1;
  text-align: center;
  transition: all 0.2s ease;
  position: relative;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  overflow: hidden;
}

/* Icons above tab text */
.primeta-tab::before {
  content: "";
  display: block;
  height: 20px;
  width: 20px;
  margin: 0 auto 4px auto;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.primeta-tab.active {
  color: #fff;
  background-color: rgba(99, 102, 241, 0.1);
  border-bottom: 2px solid #6366F1;
}

.primeta-tab.active::before {
  opacity: 1;
}

.primeta-tab:hover:not(.active) {
  background-color: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.9);
}

.primeta-tab-content {
  display: none;
}

.primeta-tab-content.active {
  display: block;
  animation: fadeIn 0.3s ease forwards;
}
```

### Form Inputs

```css
.primeta-input {
  background-color: rgba(30, 30, 56, 0.5);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  color: white;
  font-size: 14px;
  transition: all 0.2s ease;
  width: 100%;
}

.primeta-input:focus {
  border-color: #6366F1;
  background-color: rgba(30, 30, 56, 0.8);
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
}

.primeta-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.primeta-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
}

.primeta-form-group {
  margin-bottom: 20px;
}
```

### Dropdowns

```css
.primeta-select {
  background-color: rgba(30, 30, 56, 0.5);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 8px;
  padding: 12px 16px;
  color: white;
  font-size: 14px;
  transition: all 0.2s ease;
  width: 100%;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
}

.primeta-select:focus {
  border-color: #6366F1;
  background-color: rgba(30, 30, 56, 0.8);
  outline: none;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
}

.primeta-select option {
  background-color: #1E1E38;
  color: white;
}
```

## Layout Components

### Page Container

```css
.primeta-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}
```

### Grid System

```css
.primeta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

/* Adjustable columns */
.primeta-grid-2 {
  grid-template-columns: repeat(2, 1fr);
}

.primeta-grid-3 {
  grid-template-columns: repeat(3, 1fr);
}

.primeta-grid-4 {
  grid-template-columns: repeat(4, 1fr);
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .primeta-grid-4 {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .primeta-grid-3, .primeta-grid-4 {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .primeta-grid-2, .primeta-grid-3, .primeta-grid-4 {
    grid-template-columns: 1fr;
  }
}
```

### Flexbox Utilities

```css
.primeta-flex {
  display: flex;
}

.primeta-flex-col {
  flex-direction: column;
}

.primeta-items-center {
  align-items: center;
}

.primeta-justify-between {
  justify-content: space-between;
}

.primeta-justify-center {
  justify-content: center;
}

.primeta-gap-4 {
  gap: 16px;
}

.primeta-gap-6 {
  gap: 24px;
}
```

## UI Elements

### Code Blocks

```css
.primeta-code {
  background-color: rgba(30, 30, 56, 0.5);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  color: #A5B4FC;
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.primeta-code-block {
  background-color: rgba(30, 30, 56, 0.8);
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin-bottom: 16px;
  border: 1px solid rgba(99, 102, 241, 0.2);
  font-family: 'Fira Code', monospace;
  font-size: 13px;
  color: #A5B4FC;
  line-height: 1.5;
}
```

### Badges

```css
.primeta-badge {
  display: inline-flex;
  align-items: center;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: #A5B4FC;
  border-radius: 50px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
}

.primeta-badge-sm {
  padding: 2px 8px;
  font-size: 11px;
}
```

### Lists

```css
.primeta-list {
  margin-bottom: 16px;
  padding-left: 24px;
}

.primeta-list li {
  margin-bottom: 8px;
}
```

### Section Headers

```css
.primeta-heading {
  color: #A78BFA;
  margin-top: 20px;
  margin-bottom: 10px;
  font-weight: 600;
  font-size: 20px;
  border-bottom: 1px solid rgba(167, 139, 250, 0.3);
  padding-bottom: 8px;
}

.primeta-subheading {
  font-size: 18px;
  margin: 14px 0 8px 0;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 600;
}
```

## Animation

### Keyframes

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

@keyframes draw-circle {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes draw-details {
  to {
    stroke-dashoffset: 0;
  }
}
```

### Loading Spinner

```css
.primeta-spinner {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid rgba(99, 102, 241, 0.1);
  border-top-color: #6366F1;
  animation: spin 1s infinite ease-in-out;
}
```

### Transition Styles

```css
/* Default transition */
transition: all 0.2s ease;

/* Enhanced transition with bounce effect */
transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
```

## Icons

Use SVG icons with the following styles:

```css
.primeta-icon {
  width: 24px;
  height: 24px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}

.primeta-icon-sm {
  width: 20px;
  height: 20px;
}

.primeta-icon-lg {
  width: 32px;
  height: 32px;
}
```

Example SVG icon (Brain icon):
```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="primeta-icon">
  <circle cx="12" cy="12" r="10" class="brain-circle"></circle>
  <path d="M8 12c0-2.2 1.8-4 4-4s4 1.8 4 4M12 16c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" class="brain-detail"></path>
  <path d="M15 9c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2" class="brain-wave"></path>
</svg>
```

## Responsive Design

### Breakpoints

```css
/* Small screens (mobile) */
@media (max-width: 480px) {
  /* Mobile styles */
}

/* Medium screens (tablets) */
@media (max-width: 768px) {
  /* Tablet styles */
}

/* Large screens (laptops) */
@media (max-width: 1024px) {
  /* Laptop styles */
}

/* Extra large screens (desktops) */
@media (min-width: 1025px) {
  /* Desktop styles */
}
```

## Utility Classes

### Spacing

```css
.primeta-mt-4 { margin-top: 16px; }
.primeta-mr-4 { margin-right: 16px; }
.primeta-mb-4 { margin-bottom: 16px; }
.primeta-ml-4 { margin-left: 16px; }

.primeta-pt-4 { padding-top: 16px; }
.primeta-pr-4 { padding-right: 16px; }
.primeta-pb-4 { padding-bottom: 16px; }
.primeta-pl-4 { padding-left: 16px; }

.primeta-m-4 { margin: 16px; }
.primeta-p-4 { padding: 16px; }

/* Additional sizes */
.primeta-m-6 { margin: 24px; }
.primeta-p-6 { padding: 24px; }
```

### Text Styling

```css
.primeta-text-primary { color: #F8F8F2; }
.primeta-text-secondary { color: rgba(255, 255, 255, 0.9); }
.primeta-text-muted { color: rgba(255, 255, 255, 0.6); }
.primeta-text-accent { color: #A5B4FC; }
.primeta-text-header { color: #A78BFA; }

.primeta-text-center { text-align: center; }
.primeta-text-right { text-align: right; }

.primeta-font-medium { font-weight: 500; }
.primeta-font-semibold { font-weight: 600; }
```

## Best Practices

1. **Consistent Gradients**: Use the defined gradients consistently to maintain the visual identity
2. **Animation Subtlety**: Keep animations subtle and purposeful - avoid overuse
3. **Dark Background**: Maintain the dark theme throughout the application
4. **SVG Icons**: Use SVG icons with the proper styling for better scaling
5. **Border Radius**: Maintain consistent border radius values (16px for cards, 8px for form elements, 50px for buttons)
6. **Font Hierarchy**: Respect the typography hierarchy for better readability
7. **Spacing Consistency**: Use consistent spacing values based on multiples of 4px (16px, 20px, 24px)
8. **Box Shadows**: Use shadows purposefully to create depth perception
9. **Responsive Design**: Ensure all components adapt well to different screen sizes

## Implementation Tips

1. Create base CSS classes following this guide
2. Consider using CSS variables for colors and spacing to maintain consistency
3. Implement the styles incrementally, starting with the most visible components
4. Test the implementation across different devices to ensure responsive behavior
5. Maintain consistent naming conventions for all CSS classes

---

This style guide is based on the AI Assistant component design and should be applied across all Primeta.ai interfaces for a cohesive user experience. 