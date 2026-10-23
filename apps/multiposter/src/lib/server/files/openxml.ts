/**
 * Minimal OpenXML (.docx, .xlsx, .pptx) generator using standard uncompressed ZIP format.
 * Produces valid Office Open XML packages that Microsoft SharePoint / Office Online can open and edit.
 */

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
	let c = i;
	for (let k = 0; k < 8; k++) {
		c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	}
	CRC_TABLE[i] = c >>> 0;
}

function crc32(data: Uint8Array): number {
	let crc = 0xffffffff;
	for (let i = 0; i < data.length; i++) {
		crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
	}
	return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(files: Array<{ name: string; content: string }>): Uint8Array {
	const encoder = new TextEncoder();
	const localHeaders: Uint8Array[] = [];
	const centralHeaders: Uint8Array[] = [];
	let offset = 0;

	for (const f of files) {
		const nameBytes = encoder.encode(f.name);
		const dataBytes = encoder.encode(f.content);
		const crc = crc32(dataBytes);
		const size = dataBytes.length;

		// Local file header (30 bytes + name + data)
		const local = new Uint8Array(30 + nameBytes.length + size);
		const lv = new DataView(local.buffer);
		lv.setUint32(0, 0x04034b50, true); // signature
		lv.setUint16(4, 20, true); // version needed
		lv.setUint16(6, 0, true); // flags
		lv.setUint16(8, 0, true); // compression: STORE (0)
		lv.setUint16(10, 0, true); // mod time
		lv.setUint16(12, 0x21, true); // mod date
		lv.setUint32(14, crc, true);
		lv.setUint32(18, size, true);
		lv.setUint32(22, size, true);
		lv.setUint16(26, nameBytes.length, true);
		lv.setUint16(28, 0, true); // extra length
		local.set(nameBytes, 30);
		local.set(dataBytes, 30 + nameBytes.length);
		localHeaders.push(local);

		// Central directory header (46 bytes + name)
		const central = new Uint8Array(46 + nameBytes.length);
		const cv = new DataView(central.buffer);
		cv.setUint32(0, 0x02014b50, true); // signature
		cv.setUint16(4, 20, true); // version made by
		cv.setUint16(6, 20, true); // version needed
		cv.setUint16(8, 0, true); // flags
		cv.setUint16(10, 0, true); // compression: STORE
		cv.setUint16(12, 0, true); // mod time
		cv.setUint16(14, 0x21, true); // mod date
		cv.setUint32(16, crc, true);
		cv.setUint32(20, size, true);
		cv.setUint32(24, size, true);
		cv.setUint16(28, nameBytes.length, true);
		cv.setUint16(30, 0, true); // extra length
		cv.setUint16(32, 0, true); // comment length
		cv.setUint16(34, 0, true); // disk number
		cv.setUint16(36, 0, true); // internal attrs
		cv.setUint32(38, 0, true); // external attrs
		cv.setUint32(42, offset, true); // local header offset
		central.set(nameBytes, 46);
		centralHeaders.push(central);

		offset += local.length;
	}

	const centralSize = centralHeaders.reduce((acc, b) => acc + b.length, 0);
	const eocd = new Uint8Array(22);
	const ev = new DataView(eocd.buffer);
	ev.setUint32(0, 0x06054b50, true); // EOCD signature
	ev.setUint16(4, 0, true); // disk
	ev.setUint16(6, 0, true); // start disk
	ev.setUint16(8, files.length, true);
	ev.setUint16(10, files.length, true);
	ev.setUint32(12, centralSize, true);
	ev.setUint32(16, offset, true);
	ev.setUint16(20, 0, true);

	const total = offset + centralSize + eocd.length;
	const result = new Uint8Array(total);
	let pos = 0;
	for (const l of localHeaders) {
		result.set(l, pos);
		pos += l.length;
	}
	for (const c of centralHeaders) {
		result.set(c, pos);
		pos += c.length;
	}
	result.set(eocd, pos);
	return result;
}

export function generateMinimalOfficeFile(
	docType: 'docx' | 'xlsx' | 'pptx' | 'txt' | 'md',
	title = 'Document'
): { content: Uint8Array; mimeType: string; extension: string } {
	const encoder = new TextEncoder();

	if (docType === 'txt') {
		return {
			content: encoder.encode(`${title}\n`),
			mimeType: 'text/plain',
			extension: 'txt'
		};
	}

	if (docType === 'md') {
		return {
			content: encoder.encode(`# ${title}\n\n`),
			mimeType: 'text/markdown',
			extension: 'md'
		};
	}

	if (docType === 'docx') {
		const content = buildZip([
			{
				name: '[Content_Types].xml',
				content:
					'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
					'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
					'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
					'<Default Extension="xml" ContentType="application/xml"/>' +
					'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
					'</Types>'
			},
			{
				name: '_rels/.rels',
				content:
					'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
					'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
					'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
					'</Relationships>'
			},
			{
				name: 'word/document.xml',
				content:
					'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
					'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
					'<w:body><w:p><w:r><w:t></w:t></w:r></w:p></w:body>' +
					'</w:document>'
			}
		]);
		return {
			content,
			mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			extension: 'docx'
		};
	}

	if (docType === 'xlsx') {
		const content = buildZip([
			{
				name: '[Content_Types].xml',
				content:
					'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
					'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
					'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
					'<Default Extension="xml" ContentType="application/xml"/>' +
					'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
					'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
					'</Types>'
			},
			{
				name: '_rels/.rels',
				content:
					'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
					'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
					'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
					'</Relationships>'
			},
			{
				name: 'xl/workbook.xml',
				content:
					'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
					'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
					'<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>' +
					'</workbook>'
			},
			{
				name: 'xl/_rels/workbook.xml.rels',
				content:
					'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
					'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
					'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
					'</Relationships>'
			},
			{
				name: 'xl/worksheets/sheet1.xml',
				content:
					'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
					'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
					'<sheetData/>' +
					'</worksheet>'
			}
		]);
		return {
			content,
			mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			extension: 'xlsx'
		};
	}

	// pptx
	const content = buildZip([
		{
			name: '[Content_Types].xml',
			content:
				'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
				'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
				'<Default Extension="xml" ContentType="application/xml"/>' +
				'<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
				'</Types>'
		},
		{
			name: '_rels/.rels',
			content:
				'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
				'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>' +
				'</Relationships>'
		},
		{
			name: 'ppt/presentation.xml',
			content:
				'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
				'<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
				'<p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>' +
				'<p:notesSz cx="6858000" cy="9144000"/>' +
				'</p:presentation>'
		}
	]);
	return {
		content,
		mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		extension: 'pptx'
	};
}
