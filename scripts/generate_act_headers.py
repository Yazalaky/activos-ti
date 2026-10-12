from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parents[1] / "assets" / "act-templates"
PDF_DIR = ROOT / "pdf"
HEADER_DIR = ROOT / "headers"


def main():
    HEADER_DIR.mkdir(parents=True, exist_ok=True)
    for pdf_path in sorted(PDF_DIR.glob("*.pdf")):
        document = fitz.open(pdf_path)
        if len(document) < 2:
            raise ValueError(f"{pdf_path.name} no tiene las dos páginas del acta")

        for page_number, page in enumerate(document[:2], start=1):
            images = page.get_image_info(xrefs=True)
            if not images:
                raise ValueError(f"No se encontró el encabezado de la página {page_number} en {pdf_path.name}")
            bounds = fitz.Rect(images[0]["bbox"])
            output = HEADER_DIR / f"{pdf_path.stem} - page{page_number}.png"
            page.get_pixmap(matrix=fitz.Matrix(2, 2), clip=bounds, alpha=False).save(output)
            print(f"Generado: {output.relative_to(ROOT.parent.parent)}")


if __name__ == "__main__":
    main()
