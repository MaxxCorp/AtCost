import * as XLSX from 'xlsx-js-style';
import type { GroupWeeklyTimesheetData, GroupWeeklyTalentRow } from '@ac/validations';

export interface ExportWeeklyAttendanceOptions {
  organization?: string;
  groupNumber?: string;
  groupName?: string;
}

function formatDateGerman(dateInput?: string | Date | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)
    ? new Date(`${dateInput.slice(0, 10)}T00:00:00.000Z`)
    : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}.${month}.${year}`;
}

function formatDayMonth(dateInput: string | Date): string {
  const d = typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateInput)
    ? new Date(`${dateInput.slice(0, 10)}T00:00:00.000Z`)
    : new Date(dateInput);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${day}.${month}.`;
}

function convertExcuseCode(excuseType: string | null | undefined): string {
  if (!excuseType) return '';
  const trimmed = excuseType.trim();
  if (trimmed === 'Urlaub') return 'F';
  if (trimmed === 'Krank') return 'K';
  if (trimmed === 'Unentschuldigt') return 'U';
  if (trimmed === 'Wichtiger Grund') return 'E';
  if (trimmed === 'Kind krank') return 'C';
  if (trimmed === 'Tel. Krankmeldung' || trimmed === 'Tel. Krankmeld.') return 'T';
  if (trimmed === 'AZV') return 'AZV';
  return trimmed;
}

export function exportWeeklyAttendanceToExcel(
  weeklyData: GroupWeeklyTimesheetData,
  options: ExportWeeklyAttendanceOptions = {}
) {
  const [startY, startM, startD] = weeklyData.weekStartDate.split('-').map(Number);
  const mon = new Date(Date.UTC(startY, startM - 1, startD, 0, 0, 0));

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    return new Date(Date.UTC(mon.getUTCFullYear(), mon.getUTCMonth(), mon.getUTCDate() + i));
  });

  const sun = weekDates[6];
  const calendarWeek = weeklyData.weekNumber;
  const org = options.organization ?? 'Ball e.V.';
  const groupNumber = options.groupName ?? 'group_number';
  const groupName = 'Stadtteilzentrum Biesdorf';

  const ws: XLSX.WorkSheet = {};

  // Standard Border Definitions
  const borderThin = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  };

  // 1. Meta / Title Styles
  const titleStyle = {
    font: { name: 'Arial', sz: 10, bold: true },
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  const metaLabelStyle = {
    font: { name: 'Arial', sz: 10, bold: true },
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  const metaValueStyle = {
    font: { name: 'Arial', sz: 10, bold: true },
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  const metaRedValueStyle = {
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FF0000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  // 2. Table Header Styles (Rows 8 & 9)
  const headerStyle = {
    font: { name: 'Arial', sz: 11, bold: true },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    fill: { fgColor: { rgb: 'D9D9D9' } },
    border: borderThin,
  };

  // 3. Data Cell Styles (12pt Font)
  const dataCenterStyle = {
    font: { name: 'Arial', sz: 12 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin,
  };

  const dataLeftStyle = {
    font: { name: 'Arial', sz: 12 },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: borderThin,
  };

  const dataBoldCenterStyle = {
    font: { name: 'Arial', sz: 12, bold: true },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderThin,
  };

  const greyedXStyle = {
    font: { name: 'Arial', sz: 12, color: { rgb: 'A6A6A6' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    fill: { fgColor: { rgb: 'F2F2F2' } },
    border: borderThin,
  };

  // 4. Legend Styles
  const legendHeaderStyle = {
    font: { name: 'Arial', sz: 11, bold: true },
    alignment: { horizontal: 'left', vertical: 'center' },
    fill: { fgColor: { rgb: 'DCE6F1' } },
    border: borderThin,
  };

  const legendCodeStyle = {
    font: { name: 'Arial', sz: 11, bold: true },
    alignment: { horizontal: 'center', vertical: 'center' },
    fill: { fgColor: { rgb: 'E2EFDA' } },
    border: borderThin,
  };

  const legendTextStyle = {
    font: { name: 'Arial', sz: 11 },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: borderThin,
  };

  const setCell = (cellRef: string, value: any, style: any = {}, t?: string, z?: string) => {
    ws[cellRef] = {
      v: value,
      s: style,
      t: t ?? (typeof value === 'number' ? 'n' : 's'),
      ...(z ? { z } : {}),
    };
  };

  // --- Title & Metadata Section ---
  setCell('A2', 'wöchentliche Anwesenheitsliste', titleStyle);

  setCell('A3', ' Träger', metaLabelStyle);
  setCell('D3', org, metaValueStyle);

  setCell('A4', 'Maßnahmenummer', metaLabelStyle);
  setCell('D4', groupNumber, metaValueStyle);

  setCell('A5', 'Maßnahmebezeichnung', metaLabelStyle);
  setCell('D5', groupName, metaValueStyle);

  setCell('B6', 'Anwesenheitsliste', metaLabelStyle);
  setCell('D6', 'von:', metaLabelStyle);
  setCell('E6', formatDateGerman(mon), metaRedValueStyle);
  setCell('F6', 'bis:', metaLabelStyle);
  setCell('G6', formatDateGerman(sun), metaRedValueStyle);
  setCell('H6', 'Kalenderwoche:', metaLabelStyle);
  setCell('K6', calendarWeek, metaRedValueStyle, 'n');

  // --- Table Headers (Rows 8 & 9) ---
  setCell('A8', 'lfd.\nNr.', headerStyle);
  setCell('B8', 'Name', headerStyle);
  setCell('C8', 'Vorname', headerStyle);
  setCell('D8', 'Beginn', headerStyle);
  setCell('E8', 'Ende', headerStyle);
  setCell('F8', 'Kundennr.', headerStyle);
  setCell('G8', 'Tägl.\n Besch.\nStd.', headerStyle);

  const dayLetters = ['H', 'I', 'J', 'K', 'L', 'M', 'N'];
  const dayNames = ['Mo.', 'Di.\n', 'Mi.\n', 'Do.\n', 'Fr.\n', 'SA', 'So'];

  dayNames.forEach((name, i) => {
    setCell(`${dayLetters[i]}8`, name, headerStyle);
    setCell(`${dayLetters[i]}9`, formatDayMonth(weekDates[i]), headerStyle);
  });

  setCell('O8', 'Woche\ngesamt', headerStyle);

  const merges: XLSX.Range[] = [
    { s: { r: 1, c: 0 }, e: { r: 1, c: 14 } }, // A2:O2
    { s: { r: 7, c: 0 }, e: { r: 8, c: 0 } },  // A8:A9
    { s: { r: 7, c: 1 }, e: { r: 8, c: 1 } },  // B8:B9
    { s: { r: 7, c: 2 }, e: { r: 8, c: 2 } },  // C8:C9
    { s: { r: 7, c: 3 }, e: { r: 8, c: 3 } },  // D8:D9
    { s: { r: 7, c: 4 }, e: { r: 8, c: 4 } },  // E8:E9
    { s: { r: 7, c: 5 }, e: { r: 8, c: 5 } },  // F8:F9
    { s: { r: 7, c: 6 }, e: { r: 8, c: 6 } },  // G8:G9
    { s: { r: 7, c: 14 }, e: { r: 8, c: 14 } },// O8:O9
  ];

  // --- Dynamic Participant Rows ---
  let currentRow = 10;
  const rowHeights: XLSX.RowInfo[] = [
    { hpt: 15 },   // Row 1
    { hpt: 24.75 },// Row 2
    { hpt: 22.5 }, // Row 3
    { hpt: 18 },   // Row 4
    { hpt: 21.75 },// Row 5
    { hpt: 21 },   // Row 6
    { hpt: 14 },   // Row 7
    { hpt: 27.6 }, // Row 8
    { hpt: 18 },   // Row 9
  ];

  weeklyData.talents.forEach((talentRow: GroupWeeklyTalentRow, idx: number) => {
    const rowIdx = currentRow;
    const dailyHours = talentRow.dailyExpectedHours;
    const kundenNummer = talentRow.jcNumber ?? '';

    setCell(`A${rowIdx}`, idx + 1, dataCenterStyle, 'n');
    setCell(`B${rowIdx}`, talentRow.familyName, dataLeftStyle);
    setCell(`C${rowIdx}`, talentRow.givenName, dataLeftStyle);
    setCell(`D${rowIdx}`, formatDateGerman(talentRow.contractStart), dataCenterStyle);
    setCell(`E${rowIdx}`, formatDateGerman(talentRow.contractEnd), dataCenterStyle);
    setCell(`F${rowIdx}`, kundenNummer, dataCenterStyle);
    setCell(`G${rowIdx}`, dailyHours > 0 ? dailyHours : '', dataBoldCenterStyle, typeof dailyHours === 'number' ? 'n' : 's');

    let weeklyTotalHours = 0;

    // Fill Days (Mon - Sun)
    weekDates.forEach((d, dIdx) => {
      const colLetter = dayLetters[dIdx];
      const dayEntry = talentRow.days[dIdx];

      const hasExcuse = dayEntry?.excuse !== undefined && dayEntry?.excuse !== null;
      const hasHours = dayEntry?.workedHours !== undefined && dayEntry.workedHours > 0;

      if (hasExcuse) {
        if (dayEntry.excuse?.type === 'AZV') {
          let ddmm = '';
          if (dayEntry.excuse.azvFormattedFrom) {
            ddmm = dayEntry.excuse.azvFormattedFrom.slice(0, 5) + (dayEntry.excuse.azvFormattedFrom.endsWith('.') ? '' : '.');
          } else if (dayEntry.excuse.note && /vom\s+(\d{2}\.\d{2})/i.test(dayEntry.excuse.note)) {
            const match = dayEntry.excuse.note.match(/vom\s+(\d{2}\.\d{2})/i);
            if (match) ddmm = match[1] + '.';
          }

          if (ddmm) {
            setCell(`${colLetter}${rowIdx}`, `AZV vom ${ddmm}`, dataCenterStyle, 's');
          } else {
            setCell(`${colLetter}${rowIdx}`, 'AZV', dataCenterStyle, 's');
          }
        } else {
          setCell(`${colLetter}${rowIdx}`, convertExcuseCode(dayEntry.excuse?.type), dataCenterStyle, 's');
        }
      } else if (hasHours) {
        weeklyTotalHours += dayEntry.workedHours;
        setCell(`${colLetter}${rowIdx}`, dayEntry.workedHours, dataCenterStyle, 'n', '0.00');
      } else {
        setCell(`${colLetter}${rowIdx}`, 'x', dataCenterStyle, 's');
      }
    });

    const roundedTotal = Math.round(weeklyTotalHours * 100) / 100;
    setCell(`O${rowIdx}`, roundedTotal, dataBoldCenterStyle, 'n', '0.00');

    rowHeights.push({ hpt: 16 });
    currentRow++;
  });

  // --- Legend Section ---
  const legendStart = currentRow + 1;
  rowHeights.push({ hpt: 12 }); // Gap row
  rowHeights.push({ hpt: 18 }); // Legend Title row

  setCell(`B${legendStart}`, 'Legende:', legendHeaderStyle);
  setCell(`C${legendStart}`, '', legendHeaderStyle);
  setCell(`D${legendStart}`, '', legendHeaderStyle);
  merges.push({ s: { r: legendStart - 1, c: 1 }, e: { r: legendStart - 1, c: 3 } }); // Merge B:D for header

  const legendItems = [
    ['F', 'Freier Tag'],
    ['K', 'Krank'],
    ['U', 'Unentschuldigt'],
    ['E', 'Fehlen mit wichtigem Grund'],
    ['AZV', 'Arbeitszeitverlagerung'],
    ['C', 'Kind krank'],
    ['T', 'telefonische Krankmeldung'],
  ];

  legendItems.forEach(([code, label], i) => {
    const r = legendStart + 1 + i;
    setCell(`B${r}`, code, legendCodeStyle);
    setCell(`C${r}`, label, legendTextStyle);
    setCell(`D${r}`, '', legendTextStyle);
    merges.push({ s: { r: r - 1, c: 2 }, e: { r: r - 1, c: 3 } }); // Merge C:D
    rowHeights.push({ hpt: 16 });
  });

  // --- Layout Geometry (Column Widths & Row Heights) ---
  ws['!merges'] = merges;
  ws['!rows'] = rowHeights;
  ws['!cols'] = [
    { wch: 20.1 }, // A: lfd. Nr.
    { wch: 19.5 }, // B: Name
    { wch: 12.5 }, // C: Vorname
    { wch: 12.2 }, // D: Beginn
    { wch: 13.0 }, // E: Ende
    { wch: 15.5 }, // F: Kundennr.
    { wch: 9.0 },  // G: Tägl. Std.
    { wch: 13.9 }, // H: Mo.
    { wch: 13.5 }, // I: Di.
    { wch: 15.1 }, // J: Mi.
    { wch: 14.1 }, // K: Do.
    { wch: 14.9 }, // L: Fr.
    { wch: 8.4 },  // M: SA
    { wch: 8.6 },  // N: So
    { wch: 13.0 }, // O: Gesamt
  ];

  const totalRows = legendStart + legendItems.length + 2;
  ws['!ref'] = `A1:O${totalRows}`;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Anwesenheitsliste');

  const fileName = `Anwesenheitsliste_KW${calendarWeek}_${formatDateGerman(mon)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
