import React from 'react';

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  striped?: boolean;
  hoverable?: boolean;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'Nenhum registro encontrado',
  striped = true,
  hoverable = true,
  className = '',
}: TableProps<T>) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      {data.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-2 text-gray-500">{emptyMessage}</p>
        </div>
      ) : (
        <table className="min-w-full divide-y divide-gray-200" role="table">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.className || ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, index) => (
              <tr
                key={keyExtractor(row)}
                className={`${striped && index % 2 === 1 ? 'bg-gray-50' : ''} ${hoverable && onRowClick ? 'hover:bg-gray-50 cursor-pointer' : ''} transition-colors`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-3 text-sm text-gray-900 ${column.className || ''}`}>
                    {column.render ? column.render(row) : (row as Record<string, unknown>)[column.key]?.toString() || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showTotal?: boolean;
  total?: number;
}

export function Pagination({ currentPage, totalPages, onPageChange, showTotal, total }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const visiblePages = pages.filter(
    (page) => page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)
  );

  return (
    <nav className="flex items-center justify-between px-4 py-3 border-t border-gray-200" aria-label="Paginação">
      {showTotal && total !== undefined && (
        <div className="text-sm text-gray-500">
          Mostrando <span className="font-medium">{(currentPage - 1) * 10 + 1}</span> a{' '}
          <span className="font-medium">{Math.min(currentPage * 10, total)}</span> de{' '}
          <span className="font-medium">{total}</span> resultados
        </div>
      )}
      <div className="flex items-center space-x-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Página anterior"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {visiblePages.map((page, index) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
              page === currentPage
                ? 'bg-primary-600 text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
            aria-label={`Página ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page === 1 && index > 0 ? '...' : page === totalPages && index < visiblePages.length - 1 ? '...' : page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          aria-label="Próxima página"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </nav>
  );
}