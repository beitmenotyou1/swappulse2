import { useMutation } from '@tanstack/react-query';
import { generateChecklistPDF, generateBinderPagesPDF } from '@/lib/pdfGenerator';

/**
 * PDF generation mutation — wraps the client-side jspdf generator so the UI
 * gets loading/success/error states via TanStack Query's mutation API.
 */
export function usePdfGeneration() {
  return useMutation({
    mutationFn: async ({ setId, setName, totalCards, allCards, ownedLocalIds, type, options }) => {
      const pageSize = options?.pageSize || 'a4';
      const args = { setName, setId, totalCards, ownedLocalIds, allCards, pageSize };
      if (type === 'checklist') {
        generateChecklistPDF(args);
      } else {
        generateBinderPagesPDF(args);
      }
      return { success: true, type };
    },
  });
}