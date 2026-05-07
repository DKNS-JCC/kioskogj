# Guía de Diseño para Interfaz Nativa de iOS

Si el objetivo futuro (o la evolución de la aplicación) es conseguir que la aplicación **se sienta 100% nativa de iOS**, respetando estrictamente las *Human Interface Guidelines* (HIG) de Apple, se deben tener en cuenta las siguientes directrices y recomendaciones arquitectónicas:

## 1. Abandono de componentes web genéricos
Para lograr un tacto y aspecto realmente nativo, los elementos web puros o librerías de componentes UI genéricas (como Tailwind estándar o Material UI) suelen quedarse cortos imitando las físicas, inercias y acabados de iOS.

## 2. Recomendaciones de Stack para un 100% Nativo (React Native / Expo)
Si se requiere acceder a APIs puramente nativas y el renderizado nativo:

- **Componentes base:** Utilizar exclusivamente los componentes base de React Native (`View`, `Text`, `ScrollView`, etc.) y estilizarlos siguiendo las reglas de Apple, o bien apoyarse en librerías enfocadas únicamente en iOS.
- **Navegación:** Usar **React Navigation** con la configuración nativa activada (por ejemplo, `NativeStack`) para heredar automáticamente:
  - Las transiciones de pantalla con inercia nativa.
  - Las barras de navegación nativas con el efecto de desenfoque (blur) característico (ej. `headerTransparent: true` y `headerBlurEffect: 'regular'`).
  - Los gestos de retroceso deslizando desde el borde de la pantalla.
- **Listas agrupadas:** Implementar listas con el estilo *Settings* de iPhone (bordes redondeados, separadores internos que no llegan al borde izquierdo, fondo gris claro fuera de la lista y blanco en los ítems).
- **Componentes específicos de iOS:** Usar librerías que envuelvan componentes nativos reales de iOS, tales como:
  - `react-native-ios-context-menu` (para menús contextuales nativos con efecto Glassmorphism).
  - Interactividad háptica (Haptic Feedback) en botones e iteraciones importantes.

## 3. Alternativas si se mantiene como PWA Web
Si por requisitos de despliegue en la Raspberry Pi se *debe* mantener la tecnología web (Vite + React) pero se quiere **imitar** exhaustivamente la apariencia de iOS:

- **Framework7 / Konsta UI:** Adoptar un framework como [Konsta UI](https://konstaui.com/) (Tailwind CSS adaptado píxel a píxel a iOS y Android) o Framework7, que proporcionan componentes web que clonan a la perfección:
  - Las barras de navegación con `backdrop-filter: blur(...)`.
  - Los *List Views* agrupados.
  - Switches, Steppers y modales estilo iOS.
- **CSS Avanzado:** Hacer uso intensivo de `backdrop-filter` para los desenfoques, usar fuentes del sistema (`font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto...`), inhabilitar la selección de texto (`user-select: none`) y aplicar propiedades para suavizar inercia de scroll (`-webkit-overflow-scrolling: touch`).

---
> **Nota:** Este documento debe consultarse antes de hacer refactorizaciones importantes en la UI. Actualmente la Fase 1/2 es una PWA estándar (React + Tailwind), pero el salto a estas librerías será el camino para la experiencia definitiva premium en móviles.
