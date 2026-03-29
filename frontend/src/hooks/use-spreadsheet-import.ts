import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  patientsApi,
  ImportSpreadsheetRow,
  ImportSpreadsheetResult,
} from '@/lib/api/patients';
import { toast } from 'sonner';

export const useSpreadsheetImport = () => {
  const queryClient = useQueryClient();

  return useMutation<ImportSpreadsheetResult, Error, ImportSpreadsheetRow[]>({
    mutationFn: (rows: ImportSpreadsheetRow[]) =>
      patientsApi.importSpreadsheet(rows),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });

      const parts: string[] = [];
      if (data.created > 0) parts.push(`${data.created} criados`);
      if (data.updated > 0) parts.push(`${data.updated} atualizados`);
      if (data.surgeries > 0) parts.push(`${data.surgeries} cirurgias`);

      if (parts.length > 0) {
        toast.success(`Importacao concluida: ${parts.join(', ')}`);
      }

      if (data.errors.length > 0) {
        toast.warning(
          `${data.errors.length} linhas com erros. Verifique os detalhes.`
        );
      }
    },
    onError: (error) => {
      toast.error(`Erro ao importar planilha: ${error.message}`);
    },
  });
};
