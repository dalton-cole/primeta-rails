# Style Guide Integration

This document explains how we've integrated the Primeta.ai brand style guide (v1) into the application.

## Implementation Steps

1. **Brand Variables**
   - Created CSS variables with the brand colors in `app/assets/stylesheets/brand.css`
   - Implemented the brand's color palette: Electric Blue (#2979FF), Dark Navy (#0A0A23), etc.

2. **Typography**
   - Added Google Fonts (Sora and Inter) as specified in the style guide
   - Applied Sora for headings and buttons
   - Applied Inter for body text

3. **Brand Voice**
   - Updated taglines and messaging to match the brand's "Clear, bold, action-driven" tone
   - Implemented the official tagline: "The Fastest Way to Learn From Real-World Codebases"
   - Revised homepage copy to use short, declarative sentences

4. **UI Elements**
   - Updated buttons to use the brand's Electric Blue
   - Created hover states with subtle animations
   - Implemented card designs with shadow effects
   - Styled the Monaco Editor with the brand's dark navy theme

5. **Logo & Iconography**
   - Created a logo SVG based on the "Delta Spark" concept
   - Implemented as both SVG and PNG for different use cases

## Style Guide Reference

| Element | Implementation |
|:---|:---|
| **Primary Color** | Electric Blue (#2979FF) for buttons, links, and highlights |
| **Background Colors** | Dark Navy (#0A0A23) for dark mode/headers, Soft Light Gray (#F5F7FA) for backgrounds |
| **Typography** | Sora (headings), Inter (body text) |
| **Voice** | Confident, direct, action-oriented |
| **Iconography** | Minimal, geometric |

## Usage Guidelines

When developing new features:

1. Use brand colors from the CSS variables, don't hardcode color values
2. Maintain the typography hierarchy (Sora for headings, Inter for body)
3. Follow the brand voice guidelines for any user-facing text
4. Reuse existing UI patterns for consistency

## Reference Files

- `app/assets/stylesheets/brand.css` - Brand style variables and components
- `public/icon.svg` - Brand logo/icon
- `app/javascript/monaco.js` - Editor theme with brand colors 