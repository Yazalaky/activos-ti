# Formatos internos de actas

Los PDF de `pdf/` son las páginas base usadas para imprimir las actas. Los PNG de `headers/` son recortes opacos del encabezado de cada página: aplanan la máscara de transparencia que `pdf-lib` no conserva al importar algunos logos.

Si se reemplaza un PDF, instalar PyMuPDF en el entorno de Python y regenerar los encabezados con `python3 scripts/generate_act_headers.py`. Si cambia el tamaño o la posición del encabezado, actualizar también `headerRect` en `services/actPdf.ts`.
