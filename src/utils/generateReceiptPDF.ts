'use client';

import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF with the autoTable method for TypeScript
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// Define the interface for the finance data for type safety
interface FinanceData {
    id: string;
    clientName: string;
    projectName: string;
    amount: number;
    date: any; // Can be a Date or Firestore Timestamp
    method: string;
}

/**
 * Generates a payment receipt PDF document and prompts for download.
 * @param financeData - The financial transaction data.
 */
export const generateReceiptPDF = (financeData: FinanceData) => {
    // 1. Initialize Document
    const doc = new jsPDF('p', 'pt', 'a4');

    // --- Header Section ---
    const addHeader = () => {
        // Brand Name
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(33, 150, 243); // brand-blue
        doc.text("PIXELTEC.MX", 40, 60);

        // Document Title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(10, 10, 10);
        doc.text("RECIBO DE PAGO", 555, 60, { align: 'right' });

        // Folio & Date
        const folio = `REC-${financeData.id.slice(-4).toUpperCase()}`;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.text(`Folio: ${folio}`, 555, 75, { align: 'right' });
        doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-MX')}`, 555, 90, { align: 'right' });
        
        // Line separator
        doc.setDrawColor(230, 230, 230);
        doc.line(40, 110, 555, 110);
    };

    // --- "PAGADO" Watermark ---
    const addWatermark = () => {
        doc.setFontSize(80);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(48, 142, 61, 0.1); // Dark green with opacity
        doc.saveGraphicsState();
        doc.rotate(-45, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() / 2);
        doc.text("P A G A D O", doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() / 2, { align: 'center' });
        doc.restoreGraphicsState();
    };

    // --- Payment Details Section ---
    const addPaymentDetails = () => {
        let yPos = 140;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(10, 10, 10);
        doc.text("Detalles del Pago:", 40, yPos);
        
        yPos += 25;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);

        const paymentDate = financeData.date?.toDate 
            ? financeData.date.toDate().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
            : 'Fecha no disponible';

        const details = [
            { label: 'Cliente:', value: financeData.clientName },
            { label: 'Concepto:', value: financeData.projectName },
            { label: 'Fecha de Pago:', value: paymentDate },
            { label: 'Método de Pago:', value: financeData.method },
        ];

        details.forEach(detail => {
            doc.setFont('helvetica', 'bold');
            doc.text(detail.label, 40, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(detail.value, 150, yPos);
            yPos += 20;
        });
    };

    // --- Amount Table Section ---
    const addAmountTable = () => {
        const tableColumn = ["Concepto", "Monto Total"];
        const tableRows = [[
            financeData.projectName,
            `$${financeData.amount.toFixed(2)} MXN`
        ]];

        doc.autoTable({
            startY: 300,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: {
                fillColor: [10, 10, 10],
                textColor: 255,
                fontStyle: 'bold',
                halign: 'center'
            },
            bodyStyles: {
                fontSize: 12,
                halign: 'center'
            },
            columnStyles: {
                1: { fontStyle: 'bold', textColor: [48, 142, 61] } // Green text for amount
            },
            margin: { left: 40, right: 40 },
        });
    };

    // --- Footer Section ---
    const addFooter = () => {
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        const footerText = "Gracias por su negocio.\nPixelTEC | Puerto Vallarta, Jalisco, México | hola@pixeltec.mx";
        doc.text(footerText, 40, pageHeight - 60);
    };

    // --- Generate Document ---
    addHeader();
    addWatermark();
    addPaymentDetails();
    addAmountTable();
    addFooter();

    // --- Save and Download PDF ---
    const safeClientName = financeData.clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`Recibo_${safeClientName}.pdf`);
};
