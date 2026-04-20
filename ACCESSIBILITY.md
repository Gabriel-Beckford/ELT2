# Accessibility Features - Refleksyon Chat

This application is designed with accessibility as a core principle, following WCAG 2.1 guidelines to ensure a inclusive experience for all users. Below is a summary of the accessibility features implemented.

## 1. Keyboard Navigation & Focus Management
- **Skip to Main Content**: A hidden link at the top of the page (visible on focus) allows keyboard users to bypass navigation and jump directly to the chat interface.
- **Logical Focus Order**: Standard focus flow follows the visual layout of the application.
- **Visible Focus Indicators**: High-contrast focus rings are implemented across all interactive elements (buttons, inputs, tabs).
- **Keyboard-Inaccessible Content**: Message action buttons (Share, Speak, Edit, Delete) are accessible via keyboard focus (`focus-within`), removing the dependency on mouse hover.
- **Escape Key Support**: All floating menus and modals can be dismissed using the `Esc` key.

## 2. Screen Reader Support (ARIA/Semantic HTML)
- **Landmark Regions**: Uses semantic elements (`<header>`, `<main>`, `<aside>`, `<footer>`) with descriptive ARIA labels (e.g., "Chat history", "Main chat area").
- **ARIA Tabs Pattern**: Settings and configuration panels follow the formal `role="tablist"` / `role="tab"` / `role="tabpanel"` pattern for predictable navigation.
- **Menu Button Semantics**: Dropdown menus (Model, Voice, Theme) use `aria-haspopup`, `aria-expanded`, and `aria-controls` to communicate state to screen readers.
- **Programmatic Labeling**: Every input and textarea is bound to a visible `<label>` using `htmlFor`, independent of placeholder text.
- **Live Regions**: Dynamic updates (such as "Live Audio" status or "Thinking" states) are communicated via ARIA attributes where appropriate.
- **Informative Alts**: User avatars and system icons use meaningful `alt` text or are explicitly hidden from screen readers if decorative.

## 3. Motion & Cognitive Accessibility
- **Reduced Motion Support**: Full integration with the system `prefers-reduced-motion` setting. 
    - Smooth slide animations are replaced with simple fades or instantaneous changes.
    - The "Zen Pond" introduction skips timed breathing exercises and transitions immediately if motion is reduced.
    - Animated UI components (collapsible panels, success messages) disable auto-movement when active.
- **Semantic Labels for Grouped Controls**: Multi-option settings (like Kolb Learning Styles) are wrapped in `<fieldset>` and `<legend>` for clear context.
- **Slider Accessibility**: Advanced settings (like Thinking Effort) include `aria-valuemin`, `aria-valuemax`, and `aria-valuetext` to provide semantic meaning beyond just numbers.

## 4. Visual Accessibility
- **High Contrast**: UI colors are selected to meet or exceed contrast requirements for text legibility.
- **Theming**: Integrated theme system allows users to switch to high-visibility or soothing color palettes.
- **Responsive Layout**: Fluid design ensures the application remains usable even when zoomed to 200% or viewed on mobile devices.

---
*For questions or feedback regarding the accessibility of Refleksyon Chat, please contact the development team.*
