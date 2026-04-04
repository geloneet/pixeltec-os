'use client';

import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF with the autoTable method from the jspdf-autotable plugin.
// This is necessary to inform TypeScript about the added method.
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// Define interfaces for the data structures for type safety and clarity.
interface ClientData {
    companyName: string;
    contactName: string;
    location: string;
}

interface ProjectData {
    name: string;
    type: string;
    estimatedDeliveryDate?: any; // Can be a Date or Firestore Timestamp
}

interface QuoteItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

/**
 * Generates a quote PDF document and prompts the user to download it.
 * @param clientData - The client's information.
 * @param projectData - The project's details.
 * @param itemsData - An array of line items for the quote.
 */
export const generateQuotePDF = async (
  clientData: ClientData,
  projectData: ProjectData,
  itemsData: QuoteItem[]
) => {
    // Initialize a new jsPDF document in portrait, points, A4 format.
    const doc = new jsPDF('p', 'pt', 'a4');
    
    // --- 1. Header Section ---
    const addHeader = () => {
        // Brand Name
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 150, 243); // brand-blue
        doc.text("PIXELTEC.MX", 40, 60);

        // Tagline
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text("Innovación y Desarrollo Tecnológico", 40, 75);

        // Document Info
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-MX')}`, 555, 60, { align: 'right' });
        doc.text('Cotización #PT-2024-001', 555, 75, { align: 'right' }); // Example quote number
        
        // Line separator
        doc.setDrawColor(230, 230, 230);
        doc.line(40, 90, 555, 90);
    };

    // --- 2. Client and Project Information Section ---
    const addClientInfo = () => {
        let yPos = 120;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(10, 10, 10);
        doc.text("Cliente:", 40, yPos);
        
        yPos += 18;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(clientData.companyName, 40, yPos);
        
        yPos += 15;
        doc.text(`Atn: ${clientData.contactName}`, 40, yPos);
        
        yPos += 15;
        doc.text(clientData.location || 'N/A', 40, yPos);

        // Project Info on the right side
        yPos = 120;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(10, 10, 10);
        doc.text("Proyecto:", 350, yPos);

        yPos += 18;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(projectData.name, 350, yPos);

        yPos += 15;
        doc.text(`Tipo: ${projectData.type}`, 350, yPos);
        
        yPos += 15;
        // Handle both Date objects and Firestore Timestamps
        const deliveryDate = projectData.estimatedDeliveryDate?.toDate 
            ? projectData.estimatedDeliveryDate.toDate().toLocaleDateString('es-MX') 
            : 'A definir';
        doc.text(`Entrega estimada: ${deliveryDate}`, 350, yPos);
    };

    // --- 3. Costs Table Section using jspdf-autotable ---
    const addItemsTable = () => {
        const tableColumn = ["Descripción", "Cantidad", "Precio Unitario", "Total"];
        const tableRows = itemsData.map(item => [
            item.description,
            item.quantity,
            `$${item.unitPrice.toFixed(2)}`,
            `$${item.total.toFixed(2)}`
        ]);
        
        // Calculate totals before drawing the table to place them correctly
        const subtotal = itemsData.reduce((acc, item) => acc + item.total, 0);
        const iva = subtotal * 0.16;
        const total = subtotal + iva;

        // Add the table to the document
        doc.autoTable({
            startY: 200,
            head: [tableColumn],
            body: tableRows,
            theme: 'striped',
            headStyles: {
                fillColor: [10, 10, 10], // Dark header
                textColor: [255, 255, 255],
                fontStyle: 'bold',
            },
            alternateRowStyles: {
                fillColor: [248, 249, 250],
            },
            didDrawPage: (data: any) => {
                // This function is called after the table is drawn on each page
                // We draw the totals only on the last page
                if (data.pageNumber === data.pageCount) {
                    const finalY = (data.cursor as any).y || 250;
                    const totalsX = data.settings.margin.left + data.table.getWidth() - 200;
                    let totalsY = finalY + 20;

                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    
                    doc.text('Subtotal:', totalsX, totalsY);
                    doc.text(`$${subtotal.toFixed(2)} MXN`, data.settings.margin.left + data.table.getWidth(), totalsY, { align: 'right' });
                    
                    totalsY += 20;
                    doc.setFont('helvetica', 'normal');
                    doc.text('IVA (16%):', totalsX, totalsY);
                    doc.text(`$${iva.toFixed(2)} MXN`, data.settings.margin.left + data.table.getWidth(), totalsY, { align: 'right' });

                    totalsY += 20;
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Total:', totalsX, totalsY);
                    doc.text(`$${total.toFixed(2)} MXN`, data.settings.margin.left + data.table.getWidth(), totalsY, { align: 'right' });
                }
            },
            styles: {
                cellPadding: 6,
                fontSize: 9,
            },
            margin: { top: 100, right: 40, bottom: 120, left: 40 }, // Increased bottom margin for footer
        });
    };
    
    // --- 4. Footer Section ---
    const addFooter = () => {
        const pageCount = (doc.internal as any).getNumberOfPages();
        const footerY = doc.internal.pageSize.height - 100;
        
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            
            doc.setDrawColor(230, 230, 230);
            doc.line(40, footerY - 10, 555, footerY - 10);
            
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            
            const terms = "Términos y Condiciones: Vigencia de la cotización: 15 días. Precios expresados en Moneda Nacional (MXN). \nSe requiere un 50% de anticipo para iniciar el desarrollo. Pagos no son reembolsables una vez iniciado el trabajo.";
            doc.text(terms, 40, footerY, { maxWidth: 250 });

            const bankInfo = "Datos Bancarios:\nBBVA México, S.A.\nCLABE: 123456789012345678\nTitular: Miguel Angel Robles";
            doc.text(bankInfo, 555, footerY, { align: 'right' });

            doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 20, { align: 'right' });
        }
    };
    
    // --- Generate Document by calling the sections ---
    addHeader();
    addClientInfo();
    addItemsTable();
    addFooter();

    // --- 5. Save and Download PDF ---
    const safeProjectName = projectData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`Cotizacion_${safeProjectName}.pdf`);
};
