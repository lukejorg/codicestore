# Mi Aula — herramienta de estudio

Sitio estático (sin servidor) para estudiar cursos a tu ritmo, marcar avance, tomar notas y evaluarte.

## Cómo abrirlo

Sírvelo con cualquier servidor estático (GitHub Pages, Netlify, o local):

```bash
cd estudio && python3 -m http.server 8000
# abre http://localhost:8000
```

> Si abres `index.html` con doble clic, los cursos de la carpeta `cursos/` no cargan (el navegador bloquea `fetch` en `file://`), pero sí puedes usar **+ Cargar curso**.

## Agregar cursos

- **Para todos:** pon el `.json` en `cursos/` y añade su nombre a `cursos/index.json`.
- **Solo para ti:** botón **+ Cargar curso (.json)** en la portada.

## Formato del curso

```json
{
  "id": "mi-curso",
  "titulo": "Mi curso",
  "categoria": "Programación",
  "autor": "Opcional",
  "descripcion": "Texto en **Markdown**",
  "modulos": [
    {
      "titulo": "Módulo 1",
      "lecciones": [
        { "id": "intro", "titulo": "Introducción", "duracion": "5 min", "contenido": "Markdown…" },
        { "titulo": "Video", "video": "https://youtu.be/XXXXXXXXXXX", "contenido": "…" },
        { "titulo": "Repaso", "tarjetas": [{ "frente": "Pregunta", "reverso": "Respuesta" }] },
        { "titulo": "Examen", "preguntas": [
          { "pregunta": "¿…?", "opciones": ["A", "B", "C"], "correcta": 1, "explicacion": "Opcional" }
        ]},
        { "titulo": "Lecturas", "contenido": "…", "recursos": [{ "titulo": "Artículo", "url": "https://…" }] }
      ]
    }
  ]
}
```

- `id` de lección: opcional pero recomendado; si cambias el orden de las lecciones sin `id`, el avance se desalinea.
- `correcta`: índice de la opción correcta (empieza en 0). Se aprueba con 70%.
- `video`: YouTube, Vimeo o URL directa a `.mp4`.

## Dónde se guarda el avance

En `localStorage` del navegador. En **Progreso → Copia de seguridad** puedes descargarlo y restaurarlo en otro dispositivo.
