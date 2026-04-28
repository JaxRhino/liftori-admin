---
name: web-design
description: Transform AI-generated web pages from "functional" to "stunning" — a design expert skill for HTML-based creations (landing pages, slide decks, prototypes, animated explainers, posters, wireframes, galleries). Use when the user asks to design, mock up, prototype, visualize, storyboard, build a landing page, pitch deck, or any polished HTML artifact. Avoids generic web design tropes and defaults to distinctive, intentional aesthetic choices. Enforces typography discipline, intentional color use, motion as a storytelling device, and grid-breaking composition. Delegates the full rules to `system-prompt.md` in the same folder.
license: Source — github.com/ConardLi/web-design-skill (MIT-style, see LICENSE in source repo)
---

This skill makes Claude behave as an expert HTML designer — the kind that produces stunning slide decks, landing pages, prototypes, and animated explainers, not generic AI-flavored pages with purple gradients and rounded cards.

**Before acting, read the full rules:**

Read `system-prompt.md` in this skill folder. It contains ~420 lines of design expertise covering:
- Filesystem-based project workflow (one HTML file per artifact)
- Design system discovery and adherence
- Typography pairing (display + body fonts, avoiding Inter/Roboto/system defaults)
- Color + theme commitment (dominant colors with sharp accents, CSS variables)
- Motion as narrative (staggered reveals, high-impact moments)
- Spatial composition (asymmetry, overlap, grid-breaking)
- Backgrounds + atmosphere (gradient meshes, noise, geometric layers)
- Medium-specific rules for pages, decks, prototypes, posters, and animations

**Trigger this skill when the user:**
- Asks to "design", "mock up", "prototype", "visualize", "build a landing page", "create a deck", "make a poster", "animate a concept", or "turn this into a clickable mockup"
- References a brand and wants any visual artifact produced
- Says "show me options" for a design direction
- Is creating anything HTML-based that should feel designed, not generated

**What this skill enforces:**
- Committing to a bold aesthetic direction before coding (brutalist, editorial, maximalist, refined minimal, retro-futuristic, art deco, etc.)
- Fact-checking product/brand references before using them
- Typography as a first-class design decision, not a default
- Motion used at high-impact moments, not sprinkled as decoration
- Real, production-grade code — not toys

**What this skill forbids:**
- Generic "AI slop" aesthetics — purple gradients on white, Inter typeface, rounded cards with colored left borders, gradient orbs as "AI" metaphors, emoji bullets
- Placeholder images (use CSS-drawn placeholders instead)
- Convergence on common defaults across artifacts (vary fonts, palettes, layouts)

After reading `system-prompt.md`, follow its workflow exactly.
