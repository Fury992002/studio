'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  type SavedDocument, 
} from '../../page';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label";
import { INVOICE_TEMPLATE_HTML } from '../../page';

export default function SavedDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const firestore = useFirestore();
  const invoicePreviewRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(100);

  const docRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, 'documents', id);
  }, [firestore, id]);

  const { data: documentData, isLoading } = useDoc<SavedDocument>(docRef);

  const handlePrint = () => {
    if (!documentData) return;
    
    const originalTitle = document.title;
    document.title = documentData.name;

    const handleAfterPrint = () => {
      document.title = originalTitle;
      window.removeEventListener('afterprint', handleAfterPrint);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    
    // Use a small timeout to allow the document title to update before printing
    setTimeout(() => {
      window.print();
    }, 0);
  };
  
  useEffect(() => {
    if (documentData && searchParams.get('print') === 'true') {
       const timer = setTimeout(() => {
         handlePrint();
       }, 1000); // Delay to ensure content is rendered
       return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentData, searchParams]);


  const calculations = useMemo(() => {
    if (!documentData) return null;
    
    const { items, totalsData } = documentData.data;
    const totalOrder = items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    
    let totalDiscountAmount = 0;
    const discountsHtml = (totalsData.discounts || []).map(discount => {
      let discountAmount = 0;
      const discountValueStr = discount.value || '0';
      if (discountValueStr.includes('%')) {
        const percentage = parseFloat(discountValueStr.replace('%', '')) || 0;
        discountAmount = (totalOrder * percentage) / 100;
      } else {
        discountAmount = parseFloat(discountValueStr) || 0;
      }
      totalDiscountAmount += discountAmount;
      return `<p><span>${discount.title}:</span> <span>-${discountAmount.toFixed(2)}</span></p>`;
    }).join('');

    const totalAfterDiscount = totalOrder - totalDiscountAmount;
    const vatAmount = totalsData.applyVat ? totalAfterDiscount * 0.14 : 0;
    const taxAmount = totalsData.applyTax ? totalAfterDiscount * 0.01 : 0;
    const shipping = parseFloat(totalsData.shipping || '0') || 0;
    const amountDue = totalAfterDiscount + vatAmount - taxAmount + shipping;

    return {
      totalOrder: totalOrder.toFixed(2),
      totalDiscountAmount: totalDiscountAmount.toFixed(2),
      totalAfterDiscount: totalAfterDiscount.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      shipping: shipping.toFixed(2),
      amountDue: amountDue.toFixed(2),
      discountsHtml: discountsHtml,
    };
  }, [documentData]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString; 
        const day = String(date.getUTCDate()).padStart(2, '0');
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const year = date.getUTCFullYear();
        return `${day}-${month}-${year}`;
    } catch (e) {
        return dateString;
    }
  };

  const renderInvoice = () => {
    if (!documentData || !calculations) return '';
    let renderedHtml = INVOICE_TEMPLATE_HTML;
    
    const { invoiceDetailsData, clientData, items, totalsData, termsData } = documentData.data;

    const docType = invoiceDetailsData.documentType || 'Invoice';
    renderedHtml = renderedHtml.replace(/\{\{documentType\}\}/g, docType);
    
    const invoiceNo = [invoiceDetailsData.invoiceNo1, invoiceDetailsData.invoiceNo2, invoiceDetailsData.invoiceNo3].filter(Boolean).join('-');
    renderedHtml = renderedHtml.replace('{{invoice.number}}', invoiceNo || '');
    renderedHtml = renderedHtml.replace('{{invoice.date}}', formatDate(invoiceDetailsData.date) || '');

    renderedHtml = renderedHtml.replace('{{client.company}}', clientData.company || '');
    renderedHtml = renderedHtml.replace('{{client.client}}', clientData.client || '');
    renderedHtml = renderedHtml.replace('{{client.project}}', clientData.project || '');
    renderedHtml = renderedHtml.replace('{{client.designer}}', clientData.designer || '');
    renderedHtml = renderedHtml.replace('{{client.area}}', clientData.area || '');
    renderedHtml = renderedHtml.replace('{{client.location}}', clientData.location || '');
    renderedHtml = renderedHtml.replace('{{client.contactPerson}}', clientData.contactPerson || '');
    renderedHtml = renderedHtml.replace('{{client.number}}', clientData.number || '');

    const itemsHtml = items.map(item => `
      <tr>
        <td>${item.code}</td>
        <td>${item.type}</td>
        <td>${item.name}</td>
        <td>${item.color}</td>
        <td>${item.qty}</td>
        <td>${item.price.toFixed(2)}</td>
        <td>${(item.qty * item.price).toFixed(2)}</td>
      </tr>
    `).join('');
    renderedHtml = renderedHtml.replace(/\{\{#each items\}\}[\s\S]*?\{\{\/each\}\}/, itemsHtml);

    renderedHtml = renderedHtml.replace('{{terms.paymentMethod}}', termsData.paymentMethod || '');
    renderedHtml = renderedHtml.replace('{{terms.termsConditions}}', termsData.termsConditions || '');
    
    renderedHtml = renderedHtml.replace('{{calculations.totalOrder}}', calculations.totalOrder);
    renderedHtml = renderedHtml.replace('{{{calculations.discountsHtml}}}', calculations.discountsHtml);
    renderedHtml = renderedHtml.replace('{{calculations.totalAfterDiscount}}', calculations.totalAfterDiscount);
    renderedHtml = renderedHtml.replace('{{calculations.vatAmount}}', calculations.vatAmount);
    renderedHtml = renderedHtml.replace('{{calculations.taxAmount}}', calculations.taxAmount);
    renderedHtml = renderedHtml.replace('{{calculations.shipping}}', calculations.shipping);
    renderedHtml = renderedHtml.replace('{{calculations.amountDue}}', calculations.amountDue);

    // Replace the each loop for items with a simple placeholder, as we're injecting the rows directly
    const itemsPlaceholderRegex = /\{\{#each items\}\}[\s\S]*?\{\{\/each\}\}/g;
    const finalItemsHtml = items.map(item => `
        <tr>
            <td>${item.code || ''}</td>
            <td>${item.type || ''}</td>
            <td>${item.name}</td>
            <td>${item.color || ''}</td>
            <td>${item.qty}</td>
            <td>${item.price.toFixed(2)}</td>
            <td>${(item.qty * item.price).toFixed(2)}</td>
        </tr>
    `).join('');

    if (renderedHtml.match(itemsPlaceholderRegex)) {
       renderedHtml = renderedHtml.replace(itemsPlaceholderRegex, finalItemsHtml);
    } else {
       const tbodyRegex = /<tbody>\s*<\/tbody>/;
       if(renderedHtml.match(tbodyRegex)) {
          renderedHtml = renderedHtml.replace(tbodyRegex, `<tbody>${finalItemsHtml}</tbody>`);
       }
    }


    return renderedHtml;
  };

  if (isLoading) {
    return (
        <main className="min-h-screen bg-gray-100 p-4">
            <div className="container mx-auto mb-4 flex justify-between items-center no-print">
                <Skeleton className="h-8 w-1/4" />
                <div className="flex space-x-2">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>
            <div className="bg-white rounded-lg shadow-lg overflow-hidden max-w-4xl mx-auto p-8">
                <Skeleton className="h-[800px] w-full" />
            </div>
        </main>
    );
  }
  
  if (!documentData) {
    return (
        <div className="container mx-auto p-4 text-center">
            <h1 className="text-2xl font-bold mb-4">Document not found</h1>
            <p>The requested document could not be found. It might have been deleted.</p>
            <Button className="mt-4" onClick={() => router.push('/history')}>Back to History</Button>
        </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4">
        <div className="container mx-auto mb-4 flex justify-between items-center no-print">
            <h1 className="text-2xl font-bold">{documentData.name}</h1>
            <div>
                 <Button variant="outline" className="mr-2" onClick={handlePrint}>Print / Save as PDF</Button>
                 <Button
                    onClick={() => {
                        router.push('/history');
                    }}
                 >
                    Back to History
                 </Button>
            </div>
        </div>

        <div className="max-w-xs mx-auto my-4 p-4 space-y-4 border rounded-lg bg-white no-print">
            <div>
              <Label htmlFor="scale-slider" className="mb-2 block text-center">Zoom: {scale}%</Label>
              <Slider
                  id="scale-slider"
                  min={50}
                  max={150}
                  step={5}
                  value={[scale]}
                  onValueChange={(value) => setScale(value[0])}
              />
            </div>
        </div>
        
        <div 
          className="bg-white rounded-lg shadow-lg overflow-hidden max-w-4xl mx-auto invoice-preview-container"
          style={{
            zoom: `${scale / 100}`
          }}
        >
            <div ref={invoicePreviewRef} dangerouslySetInnerHTML={{ __html: renderInvoice() }} />
        </div>
    </main>
  );
}

    