"""Fill the original company DOCX and export it through LibreOffice."""

from __future__ import annotations

from datetime import datetime
from io import BytesIO
from pathlib import Path
import re
import subprocess
import tempfile
from typing import Any
from zoneinfo import ZoneInfo

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt


TEMPLATE_FILES = {
    "aliados": "Acta Aliados.docx",
    "cmi": "Acta CMI.docx",
    "gestionbienestar": "Acta Gestionar.docx",
    "logros": "Acta Logros.docx",
    "medicuc": "Acta Medicuc.docx",
    "redinsalud": "Acta Redinsalud.docx",
    "rehabilitdemos": "Acta Rehabilitdemos.docx",
    "saludfamilia": "Acta Salud Familia.docx",
}

FONT_NAME = "Arial Narrow"
W14_NS = "http://schemas.microsoft.com/office/word/2010/wordml"
PRINT_MARGIN_INCHES = 0.65
LEGAL_TEXT_INDENT_INCHES = 0.53
TABLE_FONT_SCALE = 0.9
MIN_TABLE_FONT_HALF_POINTS = 13
DEFAULT_TABLE_FONT_HALF_POINTS = 20


class ActDocumentError(ValueError):
    """The act data cannot be inserted into its original document safely."""


def _text(value: Any) -> str:
    return str(value or "").strip()


def _details_for(act: dict[str, Any]) -> dict[str, Any]:
    asset = act.get("assetSnapshot") or {}
    raw = act.get("documentDetails") or {}
    asset_type = _text(asset.get("type")).lower()
    device_defaults = {
        "desktop": asset_type == "desktop",
        "laptop": asset_type == "laptop",
        "printer": asset_type == "printer",
        "tablet": asset_type == "tablet",
        "cellphone": asset_type in {"cellphone", "mobile", "phone"},
        "other": asset_type not in {"desktop", "laptop", "printer", "tablet", "cellphone", "mobile", "phone"},
    }
    defaults = {
        "deviceTypes": device_defaults,
        "otherDeviceType": asset_type,
        "standardSoftware": {key: False for key in ("office365", "antivirus", "adobeReader", "sevenZip", "chrome", "mozilla")},
        "requestedSoftware": {key: False for key in ("tns", "tipificador", "progsalud", "ccleaner", "ipscan", "anydesk")},
        "discountSources": {key: False for key in ("fees", "salary", "benefits")},
    }
    merged = {**defaults, **raw}
    for key in ("deviceTypes", "standardSoftware", "requestedSoftware", "discountSources"):
        merged[key] = {**defaults[key], **(raw.get(key) or {})}
    return merged


def _set_cell_value(cell: Any, value: Any, font_size: float, tab_stop_inches: float | None = None) -> None:
    paragraph = cell.paragraphs[0]
    for run in paragraph.runs:
        run._element.getparent().remove(run._element)

    paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
    if tab_stop_inches is not None:
        paragraph.paragraph_format.tab_stops.add_tab_stop(
            Inches(tab_stop_inches), WD_TAB_ALIGNMENT.LEFT
        )
    content = ("\t" if tab_stop_inches is not None else "") + _text(value)
    run = paragraph.add_run(content)
    run.font.name = FONT_NAME
    run.font.size = Pt(font_size)

    for extra_paragraph in cell.paragraphs[1:]:
        for run in extra_paragraph.runs:
            run._element.getparent().remove(run._element)


def _set_checkbox_element(checkbox: Any, checked: bool) -> None:
    state = checkbox.find(f"{{{W14_NS}}}checked")
    if state is not None:
        state.set(f"{{{W14_NS}}}val", "1" if checked else "0")

    checkbox_sdt = checkbox.getparent().getparent()
    content = checkbox_sdt.find(qn("w:sdtContent"))
    if content is not None:
        for text_node in content.iter(qn("w:t")):
            text_node.text = "☒" if checked else "☐"


def _set_checkbox_cell(cell: Any, checked: bool) -> None:
    controls = cell._tc.xpath(".//w14:checkbox")
    if not controls:
        raise ActDocumentError("La plantilla perdió una casilla de selección esperada.")
    for control in controls:
        _set_checkbox_element(control, checked)


def _replace_paragraph_pattern(
    paragraph: Any,
    pattern: str,
    replacement: Any,
    *,
    label: str,
    required: bool = True,
    flags: int = 0,
) -> int:
    """Replace a text pattern even when Word split it across several runs."""
    runs = list(paragraph.runs)
    matches = list(re.finditer(pattern, "".join(run.text for run in runs), flags))
    if required and not matches:
        raise ActDocumentError(f"No se encontró el campo «{label}» en la plantilla.")

    for match in reversed(matches):
        spans = []
        offset = 0
        for run in runs:
            end = offset + len(run.text)
            spans.append((offset, end))
            offset = end
        start_index = next((i for i, (start, end) in enumerate(spans) if start <= match.start() < end), None)
        end_index = next((i for i, (start, end) in enumerate(spans) if start < match.end() <= end), None)
        if start_index is None or end_index is None:
            raise ActDocumentError(f"No se pudo editar el campo «{label}» en la plantilla.")

        value = replacement(match) if callable(replacement) else replacement
        start_offset = match.start() - spans[start_index][0]
        end_offset = match.end() - spans[end_index][0]
        if start_index == end_index:
            run = runs[start_index]
            run.text = run.text[:start_offset] + value + run.text[end_offset:]
            continue

        first_run = runs[start_index]
        last_run = runs[end_index]
        first_run.text = first_run.text[:start_offset] + value
        for index in range(start_index + 1, end_index):
            runs[index].text = ""
        last_run.text = last_run.text[end_offset:]
    return len(matches)


def _set_type_options(cell: Any, details: dict[str, Any]) -> None:
    device_types = details["deviceTypes"]
    labels = " ".join(p.text for p in cell.paragraphs).lower()
    third_option = "printer" if "impresora" in labels else "cellphone"
    selected_third = [key for key in ("printer", "cellphone") if device_types.get(key)]
    has_other = bool(device_types.get("other"))

    if len(selected_third) > 1:
        third_label = "Impresora / Celular"
        third_checked = True
    elif selected_third:
        third_key = selected_third[0]
        third_label = "Impresora" if third_key == "printer" else "Celular"
        third_checked = True
    elif has_other:
        third_label = f"Otro: {_text(details.get('otherDeviceType')) or 'Equipo'}"
        third_checked = True
    else:
        third_label = "Impresora" if third_option == "printer" else "Celular"
        third_checked = False

    for paragraph in cell.paragraphs:
        for run in paragraph.runs:
            if "Impresora" in run.text:
                run.text = run.text.replace("Impresora", third_label)
            elif "Celular" in run.text:
                run.text = run.text.replace("Celular", third_label)

    controls = cell._tc.xpath(".//w14:checkbox")
    if len(controls) < 4:
        raise ActDocumentError("La plantilla no contiene las cuatro casillas de tipo de equipo esperadas.")
    selections = [
        bool(device_types.get("desktop")),
        bool(device_types.get("laptop")),
        third_checked,
        bool(device_types.get("tablet")),
    ]
    for control, selected in zip(controls, selections):
        _set_checkbox_element(control, selected)


def _fill_legal_text(document: Any, act: dict[str, Any], template: dict[str, Any], details: dict[str, Any]) -> None:
    recipient = act.get("recipient") or {}
    full_name = _text(recipient.get("fullName"))
    document_number = _text(recipient.get("documentNumber"))
    company_name = _text(template.get("companyName")) or _text(act.get("companyId"))
    nit = _text(act.get("companyNitSnapshot")) or _text(template.get("nit"))

    party_paragraph = next((p for p in document.paragraphs if p.text.startswith("El trabajador")), None)
    if party_paragraph is None:
        raise ActDocumentError("No se encontró el párrafo legal de responsabilidad en la plantilla.")
    party_marker = "(X) o Contratista ( )" if details.get("partyType") != "contractor" else "( ) o Contratista (X)"
    _replace_paragraph_pattern(
        party_paragraph,
        r"_{3,}\s+o Contratista_{3,}",
        party_marker,
        label="tipo de vinculación",
    )

    authorization = next((p for p in document.paragraphs if p.text.startswith("En tal virtud")), None)
    if authorization is None:
        raise ActDocumentError("No se encontró el párrafo de autorización en la plantilla.")

    _replace_paragraph_pattern(
        authorization,
        r"(?<=Yo,\s)_{5,}",
        full_name,
        label="nombre del colaborador",
    )
    _replace_paragraph_pattern(
        authorization,
        r"(?P<prefix>AUTORIZO\s+a\s+)_{5,}",
        lambda match: match.group("prefix") + company_name,
        label="empresa en la autorización",
        flags=re.IGNORECASE,
    )
    if document_number:
        _replace_paragraph_pattern(
            authorization,
            r"N°\s*_{3,}",
            f"N° {document_number} ",
            label="documento del colaborador",
        )
    if nit:
        _replace_paragraph_pattern(
            authorization,
            r"Nit\._{3,}",
            f"Nit. {nit} ",
            label="NIT de la empresa",
            flags=re.IGNORECASE,
        )

    discounts = details["discountSources"]
    for label, key in (("honorarios", "fees"), ("salarios", "salary")):
        marker = "(X)" if discounts.get(key) else "( )"
        _replace_paragraph_pattern(
            authorization,
            rf"(?P<label>{label})\s+_{{3,}}",
            lambda match, value=marker: f"{match.group('label')} {value}",
            label=f"fuente de descuento {label}",
            flags=re.IGNORECASE,
        )
    if discounts.get("benefits"):
        _replace_paragraph_pattern(
            authorization,
            r"liquidación de prestaciones sociales",
            "liquidación de prestaciones sociales (X)",
            label="descuento de prestaciones sociales",
            flags=re.IGNORECASE,
        )

    amount_words = _text(details.get("discountAmountWords"))
    amount_value = _text(details.get("discountAmountValue"))
    if amount_words or amount_value:
        def replace_amount(_: Any) -> str:
            words = amount_words or "________________________"
            amount = amount_value or "________________"
            return f"(letras) {words} ($ {amount})"

        _replace_paragraph_pattern(
            authorization,
            r"\(letras\)_{3,}\(\$_{3,}\)",
            replace_amount,
            label="valor autorizado",
        )

    for paragraph in document.paragraphs:
        if paragraph.text.startswith("Nombre:"):
            _replace_paragraph_pattern(
                paragraph,
                r"(?<=Nombre:)_+",
                f" {full_name}",
                label="nombre en el espacio de firma",
            )
        elif paragraph.text.startswith("C.C. N°") and document_number:
            _replace_paragraph_pattern(
                paragraph,
                r"(?<=C\.C\. N°)_+",
                f" {document_number}",
                label="documento en el espacio de firma",
            )

    observations = _text(act.get("observations"))
    if observations:
        observation_cell = document.tables[3].cell(1, 0)
        paragraph = observation_cell.add_paragraph()
        paragraph.paragraph_format.space_before = Pt(2)
        paragraph.paragraph_format.space_after = Pt(0)
        run = paragraph.add_run(f"Observaciones adicionales: {observations}")
        run.font.name = FONT_NAME
        run.font.size = Pt(9)


def _adjust_print_layout(document: Any) -> None:
    """Use the page's full table area while preserving header and legal-text positions."""
    for section in document.sections:
        previous_left = int(section.left_margin)
        previous_right = int(section.right_margin)
        page_width = int(section.page_width)
        new_margin = Inches(PRINT_MARGIN_INCHES)
        left_delta = previous_left - int(new_margin)
        right_delta = previous_right - int(new_margin)

        # Keep floating company logos at their original physical x position when
        # the page margins change. Title boxes anchored to the page are untouched.
        headers = (section.header, section.first_page_header, section.even_page_header)
        seen_headers = set()
        for header in headers:
            header_element = header._element
            if header.is_linked_to_previous or id(header_element) in seen_headers:
                continue
            seen_headers.add(id(header_element))
            for paragraph in header.paragraphs:
                for anchor in paragraph._p.xpath(".//wp:anchor"):
                    position = anchor.find(qn("wp:positionH"))
                    if position is None or position.get("relativeFrom") not in {"margin", "column"}:
                        continue
                    alignment = position.find(qn("wp:align"))
                    if alignment is not None:
                        extent = anchor.find(qn("wp:extent"))
                        width = int(extent.get("cx", "0")) if extent is not None else 0
                        if alignment.text == "left":
                            absolute_x = previous_left
                        elif alignment.text == "center":
                            absolute_x = previous_left + (page_width - previous_left - previous_right - width) // 2
                        elif alignment.text == "right":
                            absolute_x = page_width - previous_right - width
                        else:
                            continue
                        position.remove(alignment)
                        position.set("relativeFrom", "page")
                        offset = OxmlElement("wp:posOffset")
                        offset.text = str(absolute_x)
                        position.insert(0, offset)
                    else:
                        offset = position.find(qn("wp:posOffset"))
                        if offset is not None:
                            offset.text = str(int(offset.text) + left_delta)

        section.left_margin = new_margin
        section.right_margin = new_margin

        # The body text on page two keeps its original printable width; only the
        # tables expand into the unused right-side area.
        for paragraph in document.paragraphs:
            old_left_indent = int(paragraph.paragraph_format.left_indent or 0)
            old_right_indent = int(paragraph.paragraph_format.right_indent or 0)
            paragraph.paragraph_format.left_indent = old_left_indent + left_delta
            paragraph.paragraph_format.right_indent = old_right_indent + right_delta
            if paragraph.text.startswith("AUTORIZACION DE DESCUENTO:"):
                paragraph.paragraph_format.page_break_before = True
                paragraph.paragraph_format.keep_with_next = True

    left_delta_twips = round(left_delta / 635)
    for table in document.tables:
        table_indent = table._tbl.tblPr.find(qn("w:tblInd"))
        if table_indent is not None:
            current_indent = int(table_indent.get(qn("w:w"), "0"))
            table_indent.set(qn("w:w"), str(current_indent + left_delta_twips))

        for run in table._tbl.iter(qn("w:r")):
            run_properties = run.find(qn("w:rPr"))
            if run_properties is None:
                run_properties = OxmlElement("w:rPr")
                run.insert(0, run_properties)
            font_size = run_properties.find(qn("w:sz"))
            if font_size is None:
                half_points = DEFAULT_TABLE_FONT_HALF_POINTS
                font_size = OxmlElement("w:sz")
                run_properties.append(font_size)
            else:
                half_points = max(
                    MIN_TABLE_FONT_HALF_POINTS,
                    round(int(font_size.get(qn("w:val"), str(DEFAULT_TABLE_FONT_HALF_POINTS))) * TABLE_FONT_SCALE),
                )
            font_size.set(qn("w:val"), str(half_points))
            complex_script_size = run_properties.find(qn("w:szCs"))
            if complex_script_size is not None:
                complex_script_size.set(qn("w:val"), str(half_points))


def fill_act_docx(
    template_path: str | Path,
    act: dict[str, Any],
    template: dict[str, Any],
    deliverer_name: str,
    issue_date: str | None = None,
) -> bytes:
    document = Document(str(template_path))
    if len(document.tables) != 4:
        raise ActDocumentError("La plantilla no tiene la estructura de cuatro tablas esperada.")

    recipient = act.get("recipient") or {}
    asset = act.get("assetSnapshot") or {}
    details = _details_for(act)
    tables = document.tables

    collaborator_values = [
        (1, 1, recipient.get("fullName"), 8.8),
        (1, 3, recipient.get("position"), 8.3),
        (1, 5, recipient.get("networkUser"), 8.2),
        (2, 1, recipient.get("email"), 7.8),
        (2, 3, recipient.get("area"), 8.2),
        (2, 5, " ".join(filter(None, [_text(recipient.get("phone")), f"Ext. {_text(recipient.get('extension'))}" if _text(recipient.get("extension")) else ""])), 8.2),
    ]
    for row, column, value, size in collaborator_values:
        _set_cell_value(tables[0].cell(row, column), value, size)

    hardware_values = [
        (2, 1, act.get("fixedAssetIdSnapshot"), 8.2),
        (2, 2, asset.get("brand"), 8.2),
        (2, 3, asset.get("model"), 8.2),
        (2, 4, asset.get("serial"), 8.2),
        (4, 0, asset.get("processor"), 7.3),
        (4, 1, asset.get("ram"), 7.3),
        (4, 2, asset.get("storage"), 7.3),
        (4, 3, details.get("charger"), 7.3),
        (4, 4, details.get("mouse"), 7.3),
        (6, 0, details.get("monitor"), 7.3),
        (6, 1, details.get("license"), 7.3),
        (6, 2, details.get("keyboard"), 7.3),
        (6, 3, details.get("phoneSerial"), 7.3),
        (6, 4, details.get("phoneImei"), 7.3),
    ]
    _set_type_options(tables[1].cell(2, 0), details)
    for row, column, value, size in hardware_values:
        _set_cell_value(tables[1].cell(row, column), value, size)

    software_rows = [
        ("office365", "tns"),
        ("antivirus", "tipificador"),
        ("adobeReader", "progsalud"),
        ("sevenZip", "ccleaner"),
        ("chrome", "ipscan"),
        ("mozilla", "anydesk"),
    ]
    other_entries = [line.strip() for line in str(details.get("otherSoftware") or "").splitlines() if line.strip()][:6]
    for index, (standard_key, requested_key) in enumerate(software_rows, start=2):
        row = tables[2].rows[index]
        _set_checkbox_cell(row.cells[1], bool(details["standardSoftware"].get(standard_key)))
        _set_checkbox_cell(row.cells[3], bool(details["requestedSoftware"].get(requested_key)))
        other = other_entries[index - 2] if index - 2 < len(other_entries) else ""
        _set_cell_value(row.cells[4], other, 7.4)
        _set_checkbox_cell(row.cells[5], bool(other))

    issue_date = issue_date or datetime.now(ZoneInfo("America/Bogota")).strftime("%d/%m/%Y")
    signatures = tables[3]
    for cell, value in ((signatures.cell(4, 0), _text(recipient.get("fullName"))), (signatures.cell(4, 1), _text(deliverer_name))):
        paragraph = cell.paragraphs[0]
        paragraph.paragraph_format.tab_stops.add_tab_stop(Inches(0.92), WD_TAB_ALIGNMENT.LEFT)
        run = paragraph.add_run(f"\t{value}")
        run.font.name = FONT_NAME
        run.font.size = Pt(8.3)
    for cell in (signatures.cell(6, 0), signatures.cell(6, 1)):
        paragraph = cell.paragraphs[0]
        paragraph.paragraph_format.tab_stops.add_tab_stop(Inches(1.45), WD_TAB_ALIGNMENT.LEFT)
        run = paragraph.add_run(f"\t{issue_date}")
        run.font.name = FONT_NAME
        run.font.size = Pt(9)

    _fill_legal_text(document, act, template, details)
    _adjust_print_layout(document)
    output = BytesIO()
    document.save(output)
    return output.getvalue()


def generate_act_pdf(
    templates_dir: str | Path,
    act: dict[str, Any],
    template: dict[str, Any],
    deliverer_name: str = "",
    issue_date: str | None = None,
    libreoffice: str = "soffice",
) -> tuple[bytes, str]:
    company_id = _text(act.get("companyId"))
    filename = TEMPLATE_FILES.get(company_id)
    if filename is None:
        raise ActDocumentError("No hay un DOCX original configurado para la empresa del acta.")
    template_path = Path(templates_dir) / filename
    if not template_path.is_file():
        raise ActDocumentError(f"No se encontró el documento original de {company_id}.")

    docx_bytes = fill_act_docx(template_path, act, template, deliverer_name, issue_date)
    with tempfile.TemporaryDirectory(prefix="act-render-") as temporary_dir:
        temp = Path(temporary_dir)
        docx_path = temp / "acta.docx"
        docx_path.write_bytes(docx_bytes)
        profile = temp / "lo-profile"
        command = [
            libreoffice,
            f"-env:UserInstallation={profile.as_uri()}",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(temp),
            str(docx_path),
        ]
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=90, check=False)
        except (OSError, subprocess.TimeoutExpired) as error:
            raise ActDocumentError("No se pudo iniciar LibreOffice para generar el PDF.") from error
        pdf_path = temp / "acta.pdf"
        if result.returncode != 0 or not pdf_path.is_file():
            detail = (result.stderr or result.stdout).strip()
            raise ActDocumentError(f"LibreOffice no pudo convertir el acta a PDF. {detail[:240]}")

        safe_id = re.sub(r"[^a-zA-Z0-9-]", "-", _text(act.get("fixedAssetIdSnapshot")) or "acta")
        return pdf_path.read_bytes(), f"acta-{safe_id}.pdf"
