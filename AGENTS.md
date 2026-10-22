# Despensa Familiar - Reglas del Proyecto (2º DAW)

## Propósito
Aplicación web colaborativa y accesible para gestión de lista de la compra y despensa familiar.
Diseñada con enfoque "Mobile-First" pensando en máxima simplicidad de uso para familiares no técnicos.

## Principios Técnicos (Estándares DAW)
1. **Separación de Responsabilidades:** 
   - Backend API REST limpia en `server.js`.
   - Frontend desacoplado en `/public` que consume la API con `fetch` y `async/await`.
2. **Persistencia Segura:**
   - Los datos se guardan en `data/items.json` de forma atómica para no perder datos si el servidor se reinicia.
3. **Cero Fricción de Usuario:**
   - No requerir contraseñas complejas: selector rápido de perfiles familiares (Mamá, Hijo, Papá, etc.).
   - Autocompletado inteligente con fotos y marcas (Hacendado / Open Food Facts).
   - Reconocimiento de voz nativo en navegador para dictar productos directamente con el móvil.
4. **Accesibilidad y Móvil:**
   - Botones táctiles grandes (mínimo 44px de área táctil).
   - Colores con alto contraste y feedback visual inmediato al tachar o añadir ítems.
