'use client';

import React, { useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Home, Trash2, Pencil, Printer } from 'lucide-react';
import { type SavedDocument } from '../page';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from '@/components/ui/skeleton';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

type DocsByYear = Record<string, {
  invoices: Record<string, SavedDocument[]>;
  quotations: Record<string, SavedDocument[]>;
}>;

export default function HistoryPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const documentsQuery = useMemoFirebase(() => {
    // We query for ALL documents, regardless of user.
    if (!firestore) return null;
    return query(collection(firestore, 'documents'));
  }, [firestore]);

  const { data: documents, isLoading: isLoadingDocuments } = useCollection<SavedDocument>(documentsQuery);

  const handleDelete = useCallback((docId: string) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'documents', docId);
    deleteDocumentNonBlocking(docRef);
  }, [firestore]);
  
  const handleEdit = useCallback((docId: string) => {
    router.push(`/?edit=${docId}`);
  }, [router]);

  const handlePrint = useCallback((docId: string) => {
    router.push(`/history/${docId}?print=true`);
  }, [router]);

  const categorizedDocuments = useMemo(() => {
    const byYear: DocsByYear = {};
    const others: SavedDocument[] = [];
    
    (documents || []).forEach(doc => {
      if (doc && doc.data && doc.data.invoiceDetailsData) {
        const yearStr = doc.data.invoiceDetailsData.invoiceNo3;
        const monthStr = doc.data.invoiceDetailsData.invoiceNo2;
        
        const year = yearStr ? parseInt(yearStr, 10) : NaN;
        const monthIndex = monthStr ? parseInt(monthStr, 10) - 1 : -1;

        if (!isNaN(year) && year > 1900 && year < 3000 && monthIndex >= 0 && monthIndex < 12) {
          const month = MONTHS[monthIndex];
          
          if (!byYear[yearStr!]) {
            byYear[yearStr!] = { invoices: {}, quotations: {} };
          }

          const yearData = byYear[yearStr!];
          const docType = doc.data.invoiceDetailsData.documentType;

          if (docType === 'Invoice') {
            if (!yearData.invoices[month]) yearData.invoices[month] = [];
            yearData.invoices[month].push(doc);
          } else {
            if (!yearData.quotations[month]) yearData.quotations[month] = [];
            yearData.quotations[month].push(doc);
          }
        } else {
          others.push(doc);
        }
      } else {
        // If data structure is not as expected, treat it as "other"
        others.push(doc);
      }
    });

    // Sort years in descending order
    const sortedYears = Object.keys(byYear).sort((a, b) => parseInt(b) - parseInt(a));
    const sortedByYear: DocsByYear = {};
    for (const year of sortedYears) {
      sortedByYear[year] = byYear[year];
    }
    
    return { byYear: sortedByYear, others };
  }, [documents]);

  const renderDocumentActions = useCallback((doc: SavedDocument) => (
    <div className="flex items-center">
      <Button variant="ghost" size="icon" onClick={() => handleEdit(doc.id)} title="Edit">
        <Pencil className="h-4 w-4 text-blue-500" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => handlePrint(doc.id)} title="Print / Save as PDF">
        <Printer className="h-4 w-4 text-gray-500" />
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Delete"><Trash2 className="h-4 w-4 text-red-500" /></Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the document.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDelete(doc.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  ), [handleDelete, handleEdit, handlePrint]);

  const renderMonthSection = useCallback((docsByMonth: Record<string, SavedDocument[]>) => (
    <Accordion type="multiple" className="w-full">
      {MONTHS.map(month => (
        docsByMonth[month] && docsByMonth[month].length > 0 && (
          <AccordionItem value={month} key={month}>
            <AccordionTrigger>{month} ({docsByMonth[month].length})</AccordionTrigger>
            <AccordionContent>
              {/* Correction: Wrapped the <ul> in a <div> to prevent reconciliation issues */}
              <div>
                <ul className="space-y-2">
                  {docsByMonth[month].map(doc => (
                    <li key={doc.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <Link href={`/history/${doc.id}`} className="hover:underline">
                        {doc.name}
                      </Link>
                      {renderDocumentActions(doc)}
                    </li>
                  ))}
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      ))}
    </Accordion>
  ), [renderDocumentActions]);

  const renderYearSection = useCallback((year: string, yearData: DocsByYear[string]) => (
    <AccordionItem value={year} key={year}>
      <AccordionTrigger className="text-xl font-semibold">Year {year}</AccordionTrigger>
      <AccordionContent>
        <Tabs defaultValue="invoices" className="w-full">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="quotations">Quotations</TabsTrigger>
          </TabsList>
          <TabsContent value="invoices">
            {renderMonthSection(yearData.invoices)}
          </TabsContent>
          <TabsContent value="quotations">
            {renderMonthSection(yearData.quotations)}
          </TabsContent>
        </Tabs>
      </AccordionContent>
    </AccordionItem>
  ), [renderMonthSection]);
  
  const renderLoadingSkeleton = () => (
      <div className="space-y-4">
          <Skeleton className="h-10 w-1/3" />
          <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
          </div>
      </div>
  );
  
  const renderContent = () => {
    // We check for isUserLoading to make sure Firebase auth has initialized.
    if (isUserLoading || (isLoadingDocuments && documentsQuery)) {
        return renderLoadingSkeleton();
    }
    // We check !user to make sure the person has passed the login screen.
    if (!user) {
        return <p>Please sign in to view your document history.</p>;
    }
    if (!documents || documents.length === 0) {
        return <p>No saved documents yet.</p>;
    }

    return (
        <Tabs defaultValue="byYear" className="w-full">
            <TabsList>
                <TabsTrigger value="byYear">By Year</TabsTrigger>
                <TabsTrigger value="others">Others</TabsTrigger>
            </TabsList>
            <TabsContent value="byYear">
                <Accordion type="multiple" className="w-full">
                    {Object.entries(categorizedDocuments.byYear).map(([year, yearData]) =>
                        renderYearSection(year, yearData)
                    )}
                </Accordion>
            </TabsContent>
            <TabsContent value="others">
                {categorizedDocuments.others.length > 0 ? (
                    <ul className="space-y-2 pt-4">
                        {categorizedDocuments.others.map(doc => (
                            <li key={doc.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                <Link href={`/history/${doc.id}`} className="hover:underline">
                                    {doc.name} ({doc.data?.invoiceDetailsData?.documentType})
                                </Link>
                                {renderDocumentActions(doc)}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="pt-4">No documents in the 'Others' category.</p>
                )}
            </TabsContent>
        </Tabs>
    );
  };

  return (
    <main className="container mx-auto p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Document History</CardTitle>
          <Button variant="outline" onClick={() => router.push('/')}>
            <Home className="mr-2 h-4 w-4" /> Go to Creator
          </Button>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </main>
  );
}
