# Rule: Frontend (Expo / React Native)

- **iOS-first.** Prioritize iPhone behavior and iOS Simulator verification. Do not spend effort
  on Android unless required for Expo compatibility.
- Use **Expo Router** file-based routing (`apps/mobile/app/`). Typed routes are enabled.
- Styling via **React Native StyleSheet** and `constants/theme.ts`. No heavy UI libraries.
- Reuse existing primitives in `components/` and `components/ui/` (Button, Card, IconSymbol, etc.).
- Keep the design system: Apple-clean, premium, calm, utility-first. Restrained feminine accent
  (soft pink `#f5c2e7`, dusty maroon `#7c5556`) — verify against `theme.ts` before hardcoding.
- Avoid clutter, social-feed vibes, fearmongering, cartoonish design, random bright colors.
- All user-facing copy must follow `product-boundaries.md`.
- Preserve the mock-data fallback during development; make live-vs-mock state obvious in logs.
