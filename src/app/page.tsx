'use client';

import React, { useState, useMemo, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Trash2, Save, History, PlusCircle } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';
import { addDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useAuthContext } from '@/context/AuthContext';


// Schemas for form validation
const invoiceDetailsSchema = z.object({
  documentType: z.enum(['Invoice', 'Quotation']).default('Invoice'),
  invoiceNo1: z.string().optional(),
  invoiceNo2: z.string().optional(),
  invoiceNo3: z.string().optional(),
  date: z.string().optional(),
});

const clientSchema = z.object({
  company: z.string().optional(),
  client: z.string().optional(),
  project: z.string().optional(),
  designer: z.string().optional(),
  area: z.string().optional(),
  location: z.string().optional(),
  contactPerson: z.string().optional(),
  number: z.string().optional(),
});

const itemSchema = z.object({
  code: z.string().optional(),
  type: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  color: z.string().optional(),
  qty: z.coerce.number().min(1, 'QTY must be at least 1'),
  price: z.coerce.number().min(0, 'Price must be positive'),
});

const discountSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  value: z.string().min(1, 'Value is required'),
});

const totalsSchema = z.object({
  discounts: z.array(discountSchema).optional(),
  applyVat: z.boolean().optional(),
  applyTax: z.boolean().optional(),
  shipping: z.string().optional(),
});

const termsSchema = z.object({
  paymentMethod: z.string().optional(),
  termsConditions: z.string().optional(),
});

const fullFormSchema = z.object({
  invoiceDetailsData: invoiceDetailsSchema,
  clientData: clientSchema,
  items: z.array(itemSchema),
  totalsData: totalsSchema,
  termsData: termsSchema,
});


export type InvoiceDetailsData = z.infer<typeof invoiceDetailsSchema>;
export type ClientData = z.infer<typeof clientSchema>;
export type ItemData = z.infer<typeof itemSchema>;
export type TotalsData = z.infer<typeof totalsSchema>;
export type TermsData = z.infer<typeof termsSchema>;
export type FullFormData = z.infer<typeof fullFormSchema>;

export const INVOICE_TEMPLATE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Premium {{documentType}}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    .invoice-container {
      --theme-primary-dark: #450000;
      --theme-primary-main: #b30000;
      --theme-primary-light: #d32f2f;
      --theme-accent: #ffcc00;

      font-family: 'Poppins', sans-serif;
      color: #333;
      margin: auto;
      background: #fff;
      border: 1px solid #eee;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.15);
    }
    .invoice-container.quotation-theme {
      --theme-primary-dark: #003366;
      --theme-primary-main: #005A9C;
      --theme-primary-light: #007BFF;
      --theme-accent: #ffc107;
    }
    .invoice-container header {
      position: relative;
      height: 120px;
      background: linear-gradient(135deg, var(--theme-primary-dark), var(--theme-primary-main) 60%, var(--theme-primary-light));
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 40px;
      overflow: hidden;
    }
    .invoice-container header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 5px;
      background: linear-gradient(to right, var(--theme-accent), var(--theme-primary-main));
    }
    .invoice-container #header-details p { margin: 4px 0; font-size: 14px; }
    .invoice-container #header-details p:last-child { direction: ltr; }
    .invoice-container #logo { height: 100px; width: auto; object-fit: contain; border-radius: 0.5rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
    .invoice-container #invoice-info-box { display: flex; justify-content: space-between; padding: 20px 40px; }
    .invoice-container #invoice-info-box .invoice-info { width: 48%; }
    .invoice-container #from, .invoice-container #to { line-height: 1.4; }
    .invoice-container .fromp { line-height: 2.2; }
    .invoice-container #from p, .invoice-container #to p { margin: 3px 0; }
    .invoice-container #from1, .invoice-container #to1 { color: var(--theme-primary-main); font-weight: 700; font-size: 15px; margin-bottom: 6px; display: inline-block; }
    .invoice-container table { width: 90%; margin: 10px auto 20px auto; border-collapse: collapse; font-size: 13px; text-align: center; }
    .invoice-container th { background-color: var(--theme-primary-main); color: white; padding: 10px; }
    .invoice-container table th:nth-last-child(1), .invoice-container table th:nth-last-child(2), .invoice-container table th:nth-last-child(3) { background-color: #2b2b2b; }
    .invoice-container td { padding: 8px; border-bottom: 1px solid #eee; }
    .invoice-container tr:nth-child(even) { background-color: #f4f4f4; }
    .invoice-container #totals-method { display: flex; justify-content: space-between; align-items: flex-start; padding: 25px 40px; border-top: 2px solid var(--theme-primary-main); }
    .invoice-container #payment-terms { display: flex; flex-direction: column; width: 65%; gap: 1rem;}
    .invoice-container #payment, .invoice-container #terms { font-size: 13px; }
    .invoice-container #payment p, .invoice-container #terms p { white-space: pre-wrap; }
    .invoice-container #payment strong, .invoice-container #terms strong { color: var(--theme-primary-main); font-weight: 600; font-size: 14px; }
    .invoice-container #terms { background-color: transparent; border: none; padding: 0; font-size: 13px; }
    .invoice-container #totals-container { display: flex; flex-direction: column; gap: 20px; width: 60%; align-items: flex-end; }
    .invoice-container .totals { background-color: #f2f2f2; border: 1px solid #ddd; border-radius: 8px; padding: 15px 20px; width: 60%; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
    .invoice-container .totals p { margin: 5px 0; font-size: 13px; display: flex; justify-content: space-between; }
    .invoice-container .highlight-theme { color: var(--theme-primary-main); font-weight: 600; }
    .invoice-container footer { background-color: #2b2b2b; color: white; display: flex; align-items: center; justify-content: space-between; padding: 10px 40px; font-size: 13px; position: relative; }
    .invoice-container footer .footer-contact { display: flex; align-items: center; gap: 10px; }
    .invoice-container footer .phone-numbers { display: flex; flex-direction: column; }
    .invoice-container footer .footer-separator { width: 1px; background-color: white; height: 40px; margin: 0 20px; }
    .invoice-container .data-value { font-weight: normal; margin-left: 8px; }
  </style>
</head>
<body>
  <div class="invoice-container {{themeClass}}">
    <header>
      <div id="header-details">
        <p><strong>{{documentType}} No:</strong> {{invoice.number}}</p>
        <p><strong>Date:</strong> {{invoice.date}}</p>
      </div>
      <img id="logo" src="https://i.postimg.cc/d11JgxLq/Picture1.png" alt="Company Logo" data-ai-hint="logo company">
    </header>

    <div id="invoice-info-box">
      <div class="invoice-info" id="from">
        <p id="from1">From</p>
        <p class="fromp"><strong>Align Fabrics & Curtains</strong></p>
        <p class="fromp">22 Mohamed Farid ST, Heliopolis, Nozha, New Cairo, Egypt</p>
        <p class="fromp"><strong>TCN:</strong> 652-597-947</p>
      </div>
      <div class="invoice-info" id="to">
        <p id="to1">To</p>
        <p><strong>Company:</strong><span class="data-value">{{client.company}}</span></p>
        <p><strong>Client:</strong><span class="data-value">{{client.client}}</span></p>
        <p><strong>Project:</strong><span class="data-value">{{client.project}}</span></p>
        <p><strong>Designer:</strong><span class="data-value">{{client.designer}}</span></p>
        <p><strong>Area:</strong><span class="data-value">{{client.area}}</span></p>
        <p><strong>Location:</strong><span class="data-value">{{client.location}}</span></p>
        <p><strong>Contact person:</strong><span class="data-value">{{client.contactPerson}}</span></p>p>
        <p><strong>Number:</strong><span class="data-value">{{client.number}}</span></p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Code</th><th>Type</th><th>Name</th><th>Color</th><th>QTY.</th><th>Price</th><th>Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each items}}
        <tr>
          <td>{{this.code}}</td><td>{{this.type}}</td><td>{{this.name}}</td><td>{{this.color}}</td><td>{{this.qty}}</td><td>{{this.price}}</td><td>{{this.total}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>

    <div id="totals-method">
      <div id="payment-terms">
        <div id="payment">
          <p><strong>Payment Method</strong></p>
          <p>{{terms.paymentMethod}}</p>
        </div>
        <div id="terms">
          <p><strong>Terms & Conditions</strong></p>
          <p>{{terms.termsConditions}}</p>
        </div>
      </div>
      <div id="totals-container">
        <div class="totals" id="total1">
          <p><span>Total order:</span> <span>{{calculations.totalOrder}}</span></p>
          {{{calculations.discountsHtml}}}
          <p><span class="highlight-theme">Total after discount:</span> <span class="highlight-theme">{{calculations.totalAfterDiscount}}</span></p>
        </div>
        <div class="totals" id="total2">
          <p><span>Vat 14%:</span> <span>{{calculations.vatAmount}}</span></p>
          <p><span>Tax 1%:</span> <span>{{calculations.taxAmount}}</span></p>
          <p><span>Shipping:</span> <span>{{calculations.shipping}}</span></p>
          <p><span class="highlight-theme">Amount due:</span> <span class="highlight-theme">{{calculations.amountDue}}</span></p>
        </div>
      </div>
    </div>

    <footer>
      <div class="footer-contact">
        <strong>Eng. Mohamed Kamel:</strong>
        <div class="phone-numbers">
            <span>+201119111417</span>
            <span>+201008617790</span>
        </div>
      </div>
      <div class="footer-separator"></div>
      <div class="footer-contact">
        <strong>Eng. Mohamed Sobhy:</strong>
        <div class="phone-numbers">
            <span>+201100100751</span>
            <span>+201022552290</span>
        </div>
      </div>
    </footer>
  </div>
</body>
</html>
`;

export type SavedDocument = {
  id: string;
  name: string;
  userId: string;
  data: FullFormData;
};

const defaultValues: FullFormData = {
    invoiceDetailsData: { documentType: 'Invoice', invoiceNo1: '', invoiceNo2: '', invoiceNo3: '', date: '' },
    clientData: { company: '', client: '', project: '', designer: '', area: '', location: '', contactPerson: '', number: '' },
    items: [],
    totalsData: { discounts: [], applyVat: false, applyTax: false, shipping: '' },
    termsData: { paymentMethod: '', termsConditions: '' }
};

const newItemSchema = z.object({
  code: z.string().optional(),
  type: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  color: z.string().optional(),
  qty: z.coerce.number().min(1, 'QTY must be at least 1'),
  price: z.coerce.number().min(0, 'Price must be positive'),
});

const defaultNewItem: ItemData = { code: '', type: '', name: '', color: '', qty: 0, price: 0 };


// This component isolates the logic for loading a document to be edited.
const EditDocumentLoader = ({ onDocumentLoad }: { onDocumentLoad: (docToEdit: SavedDocument) => void }) => {
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const stableOnDocumentLoad = useCallback(onDocumentLoad, [onDocumentLoad]);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && firestore) {
      const fetchDoc = async () => {
        const docRef = doc(firestore, 'documents', editId);
        try {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const docData = docSnap.data();
            const docToEdit: SavedDocument = {
              id: docSnap.id,
              name: docData.name,
              userId: docData.userId,
              data: {
                // Ensure all fields have default values to avoid 'undefined'
                invoiceDetailsData: { ...defaultValues.invoiceDetailsData, ...docData.data.invoiceDetailsData },
                clientData: { ...defaultValues.clientData, ...docData.data.clientData },
                items: docData.data.items || [],
                totalsData: { ...defaultValues.totalsData, ...docData.data.totalsData },
                termsData: { ...defaultValues.termsData, ...docData.data.termsData },
              }
            };
            stableOnDocumentLoad(docToEdit);
          } else {
            toast({
              variant: "destructive",
              title: "Error",
              description: "Document not found.",
            });
            router.push('/');
          }
        } catch (error) {
          console.error("Error fetching document:", error);
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to load document for editing.",
          });
          router.push('/');
        }
      };
      fetchDoc();
    }
  }, [firestore, searchParams, router, toast, stableOnDocumentLoad]);

  return null; // This component does not render anything itself
};

const PageContent = () => {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  
  const [docToEditId, setDocToEditId] = useState<string | null>(null);

  const methods = useForm<FullFormData>({
    resolver: zodResolver(fullFormSchema),
    defaultValues,
  });

  const { control, watch, reset, getValues } = methods;

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    control,
    name: "items"
  });

  const { fields: discountFields, append: appendDiscount, remove: removeDiscount } = useFieldArray({
    control,
    name: "totalsData.discounts"
  });

  // New item form state
  const [newItem, setNewItem] = useState<ItemData>(defaultNewItem);
  const [newItemErrors, setNewItemErrors] = useState<Record<string, string>>({});

  // Callback for EditDocumentLoader to update the form
  const handleDocumentLoad = useCallback((docToEdit: SavedDocument) => {
    setDocToEditId(docToEdit.id);
    reset(docToEdit.data);
  }, [reset]);

  const watchedData = watch();

  const handleAddItem = () => {
    const result = newItemSchema.safeParse(newItem);
    if (result.success) {
      appendItem(result.data);
      setNewItem(defaultNewItem);
      setNewItemErrors({});
    } else {
      const errors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        if (typeof issue.path[0] === 'string') {
            errors[issue.path[0]] = issue.message;
        }
      });
      setNewItemErrors(errors);
    }
  };

  const handleSave = () => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be signed in to save a document.',
      });
      return;
    }

    const currentData = getValues();
    const { invoiceDetailsData, clientData } = currentData;

    const invoiceNo = [invoiceDetailsData.invoiceNo1, invoiceDetailsData.invoiceNo2, invoiceDetailsData.invoiceNo3].filter(Boolean).join('-');
    const clientName = clientData.client;

    if (!invoiceNo || !clientName) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please provide at least an invoice/quotation number and a client name to save.',
      });
      return;
    }
    
    const docName = `${invoiceNo} - ${clientName}`;

    const documentData = {
      name: docName,
      userId: user.uid,
      data: currentData,
    };

    try {
      if (docToEditId && firestore) {
        // Update existing document
        const docRef = doc(firestore, 'documents', docToEditId);
        updateDocumentNonBlocking(docRef, documentData);
         toast({
          title: `Document Updated!`,
          description: `${invoiceDetailsData.documentType} "${docName}" has been updated.`,
        });
        router.push('/history');
      } else if (firestore) {
        // Add new document
        const collectionRef = collection(firestore, 'documents');
        addDocumentNonBlocking(collectionRef, documentData);
        toast({
          title: `Document Saved!`,
          description: `${invoiceDetailsData.documentType} "${docName}" has been saved.`,
        });
      }
    } catch (error) {
      console.error('Failed to save document:', error);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: 'There was an error while trying to save the document.',
      });
    }
  };
  

  const calculations = useMemo(() => {
    const { items, totalsData } = watchedData;
    const totalOrder = (items || []).reduce((sum, item) => sum + (item.qty * item.price), 0);

    let totalDiscountAmount = 0;
    const discountsHtml = (totalsData?.discounts || []).map(discount => {
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
    const vatAmount = totalsData?.applyVat ? totalAfterDiscount * 0.14 : 0;
    const taxAmount = totalsData?.applyTax ? totalAfterDiscount * 0.01 : 0;
    const shipping = parseFloat(totalsData?.shipping || '0') || 0;
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
  }, [watchedData]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (e) {
      return dateString; // fallback to original string if format is unexpected
    }
  };


  const renderInvoice = () => {
    let renderedHtml = INVOICE_TEMPLATE_HTML;
    const { invoiceDetailsData, clientData, items, termsData } = watchedData;
    
    const docType = invoiceDetailsData?.documentType || 'Invoice';
    renderedHtml = renderedHtml.replace(/\{\{documentType\}\}/g, docType);
    
    if (docType === 'Quotation') {
      renderedHtml = renderedHtml.replace('{{themeClass}}', 'quotation-theme');
    } else {
      renderedHtml = renderedHtml.replace('{{themeClass}}', '');
    }

    const invoiceNo = [invoiceDetailsData?.invoiceNo1, invoiceDetailsData?.invoiceNo2, invoiceDetailsData?.invoiceNo3].filter(Boolean).join('-');
    renderedHtml = renderedHtml.replace('{{invoice.number}}', invoiceNo || '');
    renderedHtml = renderedHtml.replace('{{invoice.date}}', formatDate(invoiceDetailsData?.date) || '');

    renderedHtml = renderedHtml.replace('{{client.company}}', clientData?.company || '');
    renderedHtml = renderedHtml.replace('{{client.client}}', clientData?.client || '');
    renderedHtml = renderedHtml.replace('{{client.project}}', clientData?.project || '');
    renderedHtml = renderedHtml.replace('{{client.designer}}', clientData?.designer || '');
    renderedHtml = renderedHtml.replace('{{client.area}}', clientData?.area || '');
    renderedHtml = renderedHtml.replace('{{client.location}}', clientData?.location || '');
    renderedHtml = renderedHtml.replace('{{client.contactPerson}}', clientData?.contactPerson || '');
    renderedHtml = renderedHtml.replace('{{client.number}}', clientData?.number || '');

    const itemsHtml = (items || []).map(item => `
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
    renderedHtml = renderedHtml.replace(/\{\{#each items\}\}[\s\S]*?\{\{\/each\}\}/, itemsHtml);

    renderedHtml = renderedHtml.replace('{{terms.paymentMethod}}', termsData?.paymentMethod || '');
    renderedHtml = renderedHtml.replace('{{terms.termsConditions}}', termsData?.termsConditions || '');
    
    renderedHtml = renderedHtml.replace('{{calculations.totalOrder}}', calculations.totalOrder);
    renderedHtml = renderedHtml.replace('{{{calculations.discountsHtml}}}', calculations.discountsHtml);
    renderedHtml = renderedHtml.replace('{{calculations.totalAfterDiscount}}', calculations.totalAfterDiscount);
    renderedHtml = renderedHtml.replace('{{calculations.vatAmount}}', calculations.vatAmount);
    renderedHtml = renderedHtml.replace('{{calculations.taxAmount}}', calculations.taxAmount);
    renderedHtml = renderedHtml.replace('{{calculations.shipping}}', calculations.shipping);
    renderedHtml = renderedHtml.replace('{{calculations.amountDue}}', calculations.amountDue);

    return renderedHtml;
  };
  
  return (
    <FormProvider {...methods}>
      <main className="flex flex-col lg:flex-row min-h-screen bg-gray-100 p-4 gap-4">
        <Suspense fallback={<div>Loading...</div>}>
          <EditDocumentLoader onDocumentLoad={handleDocumentLoad} />
        </Suspense>
        <div className="w-full lg:w-1/3 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{docToEditId ? 'Edit Document' : 'Controls'}</CardTitle>
              <div className="flex space-x-2">
                <Button onClick={handleSave} disabled={isUserLoading}><Save className="mr-2 h-4 w-4" /> {docToEditId ? 'Update' : 'Save'}</Button>
                <Button variant="outline" onClick={() => router.push('/history')}><History className="mr-2 h-4 w-4" /> History</Button>
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader><CardTitle>Document Details</CardTitle></CardHeader>
            <CardContent>
              <Form {...methods}>
                <form className="space-y-4">
                  <FormField
                    control={control}
                    name="invoiceDetailsData.documentType"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Document Type</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex space-x-4"
                          >
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="Invoice" />
                              </FormControl>
                              <FormLabel className="font-normal">Invoice</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="Quotation" />
                              </FormControl>
                              <FormLabel className="font-normal">Quotation</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <FormField name="invoiceDetailsData.invoiceNo1" control={control} render={({ field }) => ( <FormItem><FormLabel>No. (Part 1)</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                    <FormField name="invoiceDetailsData.invoiceNo2" control={control} render={({ field }) => ( <FormItem><FormLabel>No. (Part 2)</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                    <FormField name="invoiceDetailsData.invoiceNo3" control={control} render={({ field }) => ( <FormItem><FormLabel>No. (Part 3)</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                  </div>
                  <FormField name="invoiceDetailsData.date" control={control} render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Client Information</CardTitle></CardHeader>
            <CardContent>
              <Form {...methods}>
                <form className="space-y-4">
                  <FormField name="clientData.company" control={control} render={({ field }) => ( <FormItem><FormLabel>Company</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                  <FormField name="clientData.client" control={control} render={({ field }) => ( <FormItem><FormLabel>Client</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                  <FormField name="clientData.project" control={control} render={({ field }) => ( <FormItem><FormLabel>Project</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                  <FormField name="clientData.designer" control={control} render={({ field }) => ( <FormItem><FormLabel>Designer</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                  <FormField name="clientData.area" control={control} render={({ field }) => ( <FormItem><FormLabel>Area</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                  <FormField name="clientData.location" control={control} render={({ field }) => ( <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                  <FormField name="clientData.contactPerson" control={control} render={({ field }) => ( <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                  <FormField name="clientData.number" control={control} render={({ field }) => ( <FormItem><FormLabel>Number</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl></FormItem> )} />
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{watchedData.invoiceDetailsData?.documentType === 'Invoice' ? 'Invoice' : 'Quotation'} Items</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label htmlFor="newItemCode">Code</Label>
                      <Input id="newItemCode" value={newItem.code || ''} onChange={(e) => setNewItem({...newItem, code: e.target.value})} />
                   </div>
                   <div className="space-y-2">
                      <Label htmlFor="newItemType">Type</Label>
                      <Input id="newItemType" value={newItem.type || ''} onChange={(e) => setNewItem({...newItem, type: e.target.value})} />
                   </div>
                   <div className="space-y-2">
                      <Label htmlFor="newItemName">Name</Label>                      <Input id="newItemName" value={newItem.name} onChange={(e) => setNewItem({...newItem, name: e.target.value})} />
                      {newItemErrors.name && <p className="text-sm font-medium text-destructive">{newItemErrors.name}</p>}
                   </div>
                   <div className="space-y-2">
                      <Label htmlFor="newItemColor">Color</Label>
                      <Input id="newItemColor" value={newItem.color || ''} onChange={(e) => setNewItem({...newItem, color: e.target.value})} />
                   </div>
                   <div className="space-y-2">
                      <Label htmlFor="newItemQty">QTY</Label>
                      <Input id="newItemQty" type="number" value={newItem.qty} onChange={(e) => setNewItem({...newItem, qty: Number(e.target.value)})} />
                      {newItemErrors.qty && <p className="text-sm font-medium text-destructive">{newItemErrors.qty}</p>}
                   </div>
                   <div className="space-y-2">
                      <Label htmlFor="newItemPrice">Price</Label>
                      <Input id="newItemPrice" type="number" step="0.01" value={newItem.price} onChange={(e) => setNewItem({...newItem, price: Number(e.target.value)})} />
                      {newItemErrors.price && <p className="text-sm font-medium text-destructive">{newItemErrors.price}</p>}
                   </div>
                </div>
                <Button type="button" onClick={handleAddItem}>Add Item</Button>
              </div>
              <Separator className="my-4" />
              <div className="space-y-2">
                  <h4 className="font-medium">Added Items</h4>
                  {itemFields.length === 0 ? <p className="text-sm text-muted-foreground">No items added yet.</p> :
                    itemFields.map((item, index) => (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span>{item.name} (x{item.qty})</span>
                      <Button variant="ghost" size="icon" onClick={() => removeItem(index)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card>
              <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
              <CardContent>
                  <Form {...methods}>
                      <form className="space-y-4">
                          <div className="space-y-2">
                            <Label>Discounts</Label>
                            {discountFields.map((field, index) => (
                              <div key={field.id} className="flex items-center gap-2">
                                <FormField
                                  control={control}
                                  name={`totalsData.discounts.${index}.title`}
                                  render={({ field }) => (
                                    <FormItem className="flex-1">
                                      <FormControl><Input placeholder="Discount Title" {...field} value={field.value || ''} /></FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={control}
                                  name={`totalsData.discounts.${index}.value`}
                                  render={({ field }) => (
                                    <FormItem className="flex-1">
                                      <FormControl><Input placeholder="Value (e.g. 50 or 10%)" {...field} value={field.value || ''} /></FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeDiscount(index)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => appendDiscount({ title: '', value: '' })}
                            >
                              <PlusCircle className="mr-2 h-4 w-4" />
                              Add Discount
                            </Button>
                          </div>

                          <FormField name="totalsData.shipping" control={control} render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Shipping</FormLabel>
                                  <FormControl><Input type="number" step="0.01" {...field} value={field.value || ''} /></FormControl>
                              </FormItem>
                          )} />
                          <FormField control={control} name="totalsData.applyVat" render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                  <div className="space-y-1 leading-none">
                                      <FormLabel>Apply VAT (14%)</FormLabel>
                                  </div>
                              </FormItem>
                          )} />
                          <FormField control={control} name="totalsData.applyTax" render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                  <div className="space-y-1 leading-none">
                                      <FormLabel>Apply Withholding Tax (1%)</FormLabel>
                                  </div>
                              </FormItem>
                          )} />
                      </form>
                  </Form>
              </CardContent>
          </Card>
          
          <Card>
              <CardHeader><CardTitle>Payment & Terms</CardTitle></CardHeader>
              <CardContent>
                  <Form {...methods}>
                      <form className="space-y-4">
                          <FormField name="termsData.paymentMethod" control={control} render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Payment Method</FormLabel>
                                  <FormControl><Textarea {...field} value={field.value || ''} /></FormControl>
                              </FormItem>
                          )} />
                          <FormField name="termsData.termsConditions" control={control} render={({ field }) => (
                              <FormItem>
                                  <FormLabel>Terms & Conditions</FormLabel>
                                  <FormControl><Textarea {...field} value={field.value || ''} /></FormControl>
                              </FormItem>
                          )} />
                      </form>
                  </Form>
              </CardContent>
          </Card>
        </div>

        <div className="w-full lg:w-2/3">
          <div className="sticky top-4 overflow-x-auto">
            <div className="bg-white rounded-lg shadow-lg">
              <div 
                className="invoice-container min-w-[800px]" 
                dangerouslySetInnerHTML={{ __html: renderInvoice() }} 
              />
            </div>
          </div>
        </div>
      </main>
    </FormProvider>
  )
}

function ProtectedPage() {
    const { isAuthenticated, hasPassedAuthCheck, isLoading } = useAuthContext();
    const router = useRouter();

    useEffect(() => {
        // Only redirect if the initial auth check has completed and user is not authenticated.
        if (hasPassedAuthCheck && !isAuthenticated) {
            router.push('/login');
        }
    }, [isAuthenticated, hasPassedAuthCheck, router]);

    // Show loading state until the initial auth check is done.
    if (isLoading || !hasPassedAuthCheck) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p>Loading...</p>
            </div>
        );
    }

    // If check is done and user is authenticated, show the page content.
    if (isAuthenticated) {
        return <PageContent />;
    }

    // If check is done and user is not authenticated, they are being redirected.
    // Show a loading or blank state to prevent content flash.
    return (
      <div className="flex items-center justify-center min-h-screen">
          <p>Redirecting to login...</p>
      </div>
    );
}


export default function Home() {
    return (
        <Suspense fallback={<div>Loading Page...</div>}>
            <ProtectedPage />
        </Suspense>
    )
}

    