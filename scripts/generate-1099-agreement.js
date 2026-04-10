import { Document, Packer, Paragraph, TextRun, Header, Footer,
         AlignmentType, BorderStyle, PageNumber, HeadingLevel } from 'docx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Page dimensions for US Letter (1440 DXA = 1 inch)
const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;
const MARGIN = 1440; // 1 inch
const CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN); // 9360 DXA

// Utility function to create heading paragraphs
function createHeading(text, level = 1) {
  const sizes = { 1: 32, 2: 28, 3: 24 };
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : (level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3),
    children: [new TextRun({ text, bold: true, size: sizes[level] || 24, font: 'Arial' })],
    spacing: { before: 200, after: 120 },
  });
}

// Utility function to create regular paragraphs
function createParagraph(text, bold = false, indent = 0) {
  return new Paragraph({
    children: [new TextRun({ text, bold, size: 22, font: 'Arial' })],
    spacing: { line: 360, after: 120 },
    indent: { left: indent, hanging: 0 },
  });
}

// Utility function for numbered sections
function createNumberedSection(number, title, content) {
  const children = [new TextRun({ text: `${number}. ${title}`, bold: true, size: 22, font: 'Arial' })];
  return new Paragraph({
    children,
    spacing: { before: 200, after: 80 },
  });
}

// Create the document
const sections = [{
  properties: {
    page: {
      size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
      margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'LIFTORI AI LLC — INDEPENDENT CONTRACTOR AGREEMENT', bold: true, size: 22, font: 'Arial' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' } },
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'Page ', size: 20, font: 'Arial' }), new TextRun({ children: [PageNumber.CURRENT], size: 20, font: 'Arial' })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 120 },
          }),
        ],
      }),
    },
  },
  children: [
    // Title
    new Paragraph({
      children: [new TextRun({ text: 'INDEPENDENT CONTRACTOR AGREEMENT', bold: true, size: 32, font: 'Arial' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),

    // Effective Date
    new Paragraph({
      children: [new TextRun({ text: 'Effective Date: [DATE]', size: 22, font: 'Arial' })],
      spacing: { after: 240 },
    }),

    // Preamble
    createParagraph('This Independent Contractor Agreement (hereinafter "Agreement") is entered into on [DATE] ("Effective Date"), by and between Liftori AI LLC, a Florida limited liability company, with principal place of business at [Company Address], Florida (hereinafter "Company"), and [Contractor Name], an individual with principal place of business at [Contractor Address] (hereinafter "Contractor").'),

    createParagraph('WHEREAS, the Company desires to engage the Contractor to provide certain services on an independent contractor basis; and'),

    createParagraph('WHEREAS, the Contractor desires to provide such services to the Company on the terms and conditions set forth herein;'),

    createParagraph('NOW, THEREFORE, in consideration of the mutual covenants and agreements contained herein and for other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, the parties agree as follows:'),

    // Section 1: Parties
    createNumberedSection('1', 'PARTIES'),
    createParagraph('The parties to this Agreement are:'),
    new Paragraph({
      children: [new TextRun({ text: '(a) Liftori AI LLC, a Florida limited liability company ("Company"); and', size: 22, font: 'Arial' })],
      spacing: { after: 80 },
      indent: { left: 720 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '(b) [Contractor Name], an individual contractor ("Contractor").', size: 22, font: 'Arial' })],
      spacing: { after: 200 },
      indent: { left: 720 },
    }),

    // Section 2: Scope of Services
    createNumberedSection('2', 'SCOPE OF SERVICES'),
    createParagraph('The Contractor agrees to provide the following services to the Company:'),
    new Paragraph({
      children: [new TextRun({ text: '[Description of Services and Role]: [Contractor will perform the following duties and responsibilities for the Company]', size: 22, font: 'Arial' })],
      spacing: { after: 80 },
      indent: { left: 720 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '[Key Deliverables]: [Specify measurable outputs and deliverables expected from the Contractor]', size: 22, font: 'Arial' })],
      spacing: { after: 200 },
      indent: { left: 720 },
    }),
    createParagraph('The Contractor shall perform the services in a professional and workmanlike manner in accordance with industry standards and the Company\'s written instructions.'),

    // Section 3: Independent Contractor Status
    createNumberedSection('3', 'INDEPENDENT CONTRACTOR STATUS'),
    createParagraph('The Contractor is an independent contractor and is not an employee of the Company. The Contractor is not entitled to any employee benefits, including but not limited to health insurance, retirement plans, paid leave, or workers\' compensation. The Company will not withhold federal, state, or local income taxes, Social Security taxes, or unemployment taxes from the Contractor\'s compensation. The Contractor is solely responsible for all tax obligations, including but not limited to quarterly estimated tax payments.'),

    createParagraph('The Contractor has the right to control the means and manner of performing the services, subject to the Company\'s right to specify the desired results and to inspect and approve the work.'),

    // Section 4: Compensation and Payment
    createNumberedSection('4', 'COMPENSATION AND PAYMENT'),
    new Paragraph({
      children: [new TextRun({ text: '4.1 Rate and Method of Compensation', bold: true, size: 22, font: 'Arial' })],
      spacing: { before: 120, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'The Company shall pay the Contractor at the following rate for services rendered:', size: 22, font: 'Arial' })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '[Compensation Rate]: [Hourly Rate $[X]/hour | Monthly Retainer $[X]/month | Project-Based Fee $[X] for [Project Description]]', size: 22, font: 'Arial' })],
      spacing: { after: 200 },
      indent: { left: 720 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '4.2 Invoicing and Payment Schedule', bold: true, size: 22, font: 'Arial' })],
      spacing: { before: 120, after: 80 },
    }),
    createParagraph('The Contractor shall invoice the Company upon completion of services or on [weekly/bi-weekly/monthly] basis with detailed descriptions of work performed. All invoices must be submitted within [number] days of work completion. Payment shall be made within fifteen (15) days of receipt of invoice ("Net 15"), by [payment method: check, ACH transfer, wire transfer].'),

    new Paragraph({
      children: [new TextRun({ text: '4.3 Expenses', bold: true, size: 22, font: 'Arial' })],
      spacing: { before: 120, after: 80 },
    }),
    createParagraph('Unless otherwise agreed in writing, the Contractor shall be responsible for all expenses incurred in performing services under this Agreement, including but not limited to equipment, software, office supplies, and travel expenses. The Company shall not reimburse expenses unless explicitly authorized in writing in advance.'),

    // Section 5: Term and Termination
    createNumberedSection('5', 'TERM AND TERMINATION'),
    new Paragraph({
      children: [new TextRun({ text: '5.1 Term', bold: true, size: 22, font: 'Arial' })],
      spacing: { before: 120, after: 80 },
    }),
    createParagraph('This Agreement shall commence on [Start Date] and shall continue on an ongoing basis until terminated by either party in accordance with the provisions of this Section.'),

    new Paragraph({
      children: [new TextRun({ text: '5.2 Termination Without Cause', bold: true, size: 22, font: 'Arial' })],
      spacing: { before: 120, after: 80 },
    }),
    createParagraph('Either party may terminate this Agreement without cause upon fourteen (14) days written notice to the other party. Upon termination, the Contractor shall cease performance of services and shall return all Company property within two (2) business days.'),

    new Paragraph({
      children: [new TextRun({ text: '5.3 Termination for Cause', bold: true, size: 22, font: 'Arial' })],
      spacing: { before: 120, after: 80 },
    }),
    createParagraph('The Company may terminate this Agreement immediately for cause if the Contractor:'),
    new Paragraph({
      children: [new TextRun({ text: '(a) Breaches any material term of this Agreement or any attached Confidentiality Agreement or NDA and fails to cure such breach within five (5) days of written notice;', size: 22, font: 'Arial' })],
      spacing: { after: 80 },
      indent: { left: 720 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '(b) Engages in misconduct, fraud, dishonesty, or violation of applicable laws;', size: 22, font: 'Arial' })],
      spacing: { after: 80 },
      indent: { left: 720 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '(c) Fails to perform services in a professional manner or fails to meet agreed-upon deliverables or quality standards;', size: 22, font: 'Arial' })],
      spacing: { after: 200 },
      indent: { left: 720 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '(d) Violates the confidentiality or non-solicitation provisions of this Agreement.', size: 22, font: 'Arial' })],
      spacing: { after: 80 },
      indent: { left: 720 },
    }),

    // Section 6: Intellectual Property
    createNumberedSection('6', 'INTELLECTUAL PROPERTY ASSIGNMENT'),
    createParagraph('The Contractor acknowledges that all work product, including but not limited to source code, software, documentation, designs, creative materials, databases, methodologies, concepts, and inventions ("Work Product") created, developed, or conceived by the Contractor during the term of this Agreement and within the scope of services shall be considered "work made for hire" and shall be the exclusive property of the Company.'),

    createParagraph('The Contractor hereby assigns all right, title, and interest in and to any Work Product to the Company, including all intellectual property rights, copyrights, patents, trade secrets, and moral rights. The Contractor waives any moral rights, droit d\'auteur, or similar rights in the Work Product.'),

    createParagraph('The Contractor shall execute all documents and take all actions reasonably necessary to perfect the Company\'s ownership rights in the Work Product, including but not limited to copyright registration documents and patent assignment agreements.'),

    createParagraph('Work Product created outside the scope of services and not using Company resources or time may be retained by the Contractor only if such Work Product is disclosed to the Company in writing prior to creation.'),

    // Section 7: Confidentiality
    createNumberedSection('7', 'CONFIDENTIALITY'),
    createParagraph('The Contractor acknowledges that in performing services, the Contractor will have access to confidential and proprietary information of the Company, including but not limited to business plans, financial information, customer data, algorithms, technical specifications, and trade secrets ("Confidential Information").'),

    createParagraph('The Contractor agrees to:'),
    new Paragraph({
      children: [new TextRun({ text: '(a) Maintain all Confidential Information in strict confidence;', size: 22, font: 'Arial' })],
      spacing: { after: 80 },
      indent: { left: 720 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '(b) Not disclose Confidential Information to any third party without prior written consent of the Company;', size: 22, font: 'Arial' })],
      spacing: { after: 80 },
      indent: { left: 720 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '(c) Not use Confidential Information for any purpose other than performing services for the Company;', size: 22, font: 'Arial' })],
      spacing: { after: 80 },
      indent: { left: 720 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '(d) Return all Confidential Information upon termination of this Agreement.', size: 22, font: 'Arial' })],
      spacing: { after: 200 },
      indent: { left: 720 },
    }),
    createParagraph('These obligations shall survive termination of this Agreement. The Contractor acknowledges that a separate Confidentiality Agreement or Non-Disclosure Agreement may be executed as a condition of engagement, the terms of which shall incorporate into and be part of this Agreement.'),

    // Section 8: Non-Solicitation
    createNumberedSection('8', 'NON-SOLICITATION'),
    createParagraph('During the term of this Agreement and for a period of two (2) years following termination or expiration hereof, the Contractor agrees not to, directly or indirectly:'),
    new Paragraph({
      children: [new TextRun({ text: '(a) Solicit or attempt to solicit for engagement, as an employee or independent contractor, any person who is a client or customer of the Company or with whom the Company has an active business relationship;', size: 22, font: 'Arial' })],
      spacing: { after: 80 },
      indent: { left: 720 },
    }),
    new Paragraph({
      children: [new TextRun({ text: '(b) Solicit or attempt to solicit for engagement any contractor, subcontractor, or vendor who is engaged by the Company.', size: 22, font: 'Arial' })],
      spacing: { after: 200 },
      indent: { left: 720 },
    }),
    createParagraph('This restriction applies only to business relationships known to the Contractor as a result of providing services to the Company.'),

    // Section 9: Equipment and Tools
    createNumberedSection('9', 'EQUIPMENT AND TOOLS'),
    createParagraph('Unless otherwise specified in writing, the Contractor shall provide all equipment, software, tools, and materials necessary to perform services under this Agreement. The Contractor is responsible for maintaining equipment and software in good working order and ensuring compliance with all applicable licenses and agreements.'),

    createParagraph('If the Company provides access to Company systems, accounts, software licenses, or data, the Contractor acknowledges that such access is provided solely for performance of services under this Agreement. All such access credentials, accounts, and materials remain the exclusive property of the Company and shall be returned or disabled upon termination of this Agreement.'),

    // Section 10: Insurance and Liability
    createNumberedSection('10', 'INSURANCE AND LIABILITY'),
    createParagraph('The Contractor shall obtain and maintain, at the Contractor\'s own expense, all insurance coverage reasonably necessary to cover the Contractor\'s performance of services, including general liability insurance. The Contractor shall provide proof of insurance upon request.'),

    createParagraph('The Contractor shall indemnify, defend, and hold harmless the Company, its officers, directors, employees, and agents from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys\' fees) arising from or related to: (a) the Contractor\'s breach of this Agreement; (b) the Contractor\'s negligence or willful misconduct; (c) claims by third parties that the Work Product infringes their intellectual property rights; or (d) any injury or damage caused by the Contractor\'s performance of services.'),

    // Section 11: Tax Obligations
    createNumberedSection('11', 'TAX OBLIGATIONS'),
    createParagraph('The Contractor is solely responsible for all federal, state, and local income taxes, self-employment taxes, and any other tax obligations arising from compensation received under this Agreement. The Company will not withhold or remit any taxes on behalf of the Contractor.'),

    createParagraph('The Contractor shall be issued a Form 1099-NEC by January 31 of the year following payment for any calendar year in which the Contractor receives compensation of $600 or more. Prior to the first payment under this Agreement, the Contractor shall complete and provide to the Company a completed W-9 form (Request for Taxpayer Identification Number and Certification).'),

    createParagraph('The Contractor acknowledges full responsibility for timely payment of estimated quarterly taxes and for maintaining accurate records for tax reporting purposes.'),

    // Section 12: Dispute Resolution
    createNumberedSection('12', 'DISPUTE RESOLUTION'),
    createParagraph('Any dispute, claim, or disagreement arising out of or relating to this Agreement or the Contractor\'s performance of services shall be resolved as follows:'),

    new Paragraph({
      children: [new TextRun({ text: '12.1 Mediation', bold: true, size: 22, font: 'Arial' })],
      spacing: { before: 120, after: 80 },
    }),
    createParagraph('The parties agree to attempt to resolve any dispute through good-faith negotiation and mediation before initiating formal proceedings. Each party shall designate a representative with authority to settle the dispute.'),

    new Paragraph({
      children: [new TextRun({ text: '12.2 Binding Arbitration', bold: true, size: 22, font: 'Arial' })],
      spacing: { before: 120, after: 80 },
    }),
    createParagraph('If mediation fails to resolve the dispute within thirty (30) days, the parties agree that the dispute shall be resolved by binding arbitration administered by the American Arbitration Association (AAA) under its Commercial Arbitration Rules. The arbitration shall be conducted in Broward County, Florida. The cost of arbitration shall be shared equally by the parties, except that each party shall bear its own attorneys\' fees and costs. The arbitration award shall be final and binding and may be enforced in any court of competent jurisdiction.'),

    // Section 13: Governing Law
    createNumberedSection('13', 'GOVERNING LAW'),
    createParagraph('This Agreement shall be governed by and construed in accordance with the laws of the State of Florida, without regard to its conflicts of law principles. Both parties consent to the exclusive jurisdiction of the state and federal courts located in Broward County, Florida.'),

    // Section 14: Entire Agreement
    createNumberedSection('14', 'ENTIRE AGREEMENT'),
    createParagraph('This Agreement, together with any exhibits, attachments, and any separate Confidentiality Agreement or Non-Disclosure Agreement, constitutes the entire agreement between the parties and supersedes all prior agreements, understandings, and negotiations, whether written or oral, relating to the subject matter hereof. No oral modification of this Agreement shall be valid or binding on either party.'),

    // Section 15: Amendment
    createNumberedSection('15', 'AMENDMENT'),
    createParagraph('This Agreement may not be amended, modified, or supplemented except by a written instrument executed by authorized representatives of both the Company and the Contractor.'),

    // Section 16: Severability
    createNumberedSection('16', 'SEVERABILITY'),
    createParagraph('If any provision of this Agreement is found to be invalid, illegal, or unenforceable, such provision shall be severed from this Agreement, and the remaining provisions shall remain in full force and effect. If any provision is found to be overly broad, it shall be modified to the minimum extent necessary to make it valid and enforceable.'),

    // Section 17: Counterparts
    createNumberedSection('17', 'COUNTERPARTS'),
    createParagraph('This Agreement may be executed in counterparts, each of which shall be deemed an original and all of which together shall constitute one and the same instrument. Execution and delivery by electronic means (PDF or DocuSign) shall have the same effect as delivery of manually executed originals.'),

    // Signature Section
    new Paragraph({
      children: [new TextRun({ text: 'IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.', size: 22, font: 'Arial' })],
      spacing: { before: 240, after: 240 },
    }),

    new Paragraph({
      children: [new TextRun({ text: 'COMPANY:', bold: true, size: 22, font: 'Arial' })],
      spacing: { after: 120 },
    }),

    new Paragraph({
      children: [new TextRun({ text: 'LIFTORI AI LLC', size: 22, font: 'Arial' })],
      spacing: { after: 200 },
    }),

    new Paragraph({
      children: [new TextRun({ text: '_________________________________', size: 22, font: 'Arial' })],
      spacing: { after: 60 },
    }),

    new Paragraph({
      children: [new TextRun({ text: 'Authorized Signatory', size: 22, font: 'Arial' })],
      spacing: { after: 60 },
    }),

    new Paragraph({
      children: [new TextRun({ text: 'Name (Print): ______________________________', size: 22, font: 'Arial' })],
      spacing: { after: 60 },
    }),

    new Paragraph({
      children: [new TextRun({ text: 'Title: ______________________________', size: 22, font: 'Arial' })],
      spacing: { after: 60 },
    }),

    new Paragraph({
      children: [new TextRun({ text: 'Date: ______________________________', size: 22, font: 'Arial' })],
      spacing: { after: 400 },
    }),

    new Paragraph({
      children: [new TextRun({ text: 'CONTRACTOR:', bold: true, size: 22, font: 'Arial' })],
      spacing: { after: 120 },
    }),

    new Paragraph({
      children: [new TextRun({ text: '_________________________________', size: 22, font: 'Arial' })],
      spacing: { after: 60 },
    }),

    new Paragraph({
      children: [new TextRun({ text: 'Contractor Signature', size: 22, font: 'Arial' })],
      spacing: { after: 60 },
    }),

    new Paragraph({
      children: [new TextRun({ text: 'Name (Print): ______________________________', size: 22, font: 'Arial' })],
      spacing: { after: 60 },
    }),

    new Paragraph({
      children: [new TextRun({ text: 'Date: ______________________________', size: 22, font: 'Arial' })],
      spacing: { after: 60 },
    }),

    new Paragraph({
      children: [new TextRun({ text: 'Address: ______________________________', size: 22, font: 'Arial' })],
      spacing: { after: 60 },
    }),

    new Paragraph({
      children: [new TextRun({ text: 'Phone: ______________________________', size: 22, font: 'Arial' })],
      spacing: { after: 60 },
    }),

    new Paragraph({
      children: [new TextRun({ text: 'Email: ______________________________', size: 22, font: 'Arial' })],
      spacing: { after: 60 },
    }),
  ],
}];

const doc = new Document({ sections });

// Create output directory if it doesn't exist
const outputDir = '/sessions/awesome-blissful-hypatia/mnt/Liftori Ai/liftori.ai/liftori-admin/public/templates';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'liftori-1099-agreement-template.docx');

// Generate the document
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outputPath, buffer);
  console.log(`✓ Independent Contractor Agreement created successfully at: ${outputPath}`);
  process.exit(0);
}).catch(err => {
  console.error('Error creating document:', err);
  process.exit(1);
});
