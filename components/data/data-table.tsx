'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Edit2, Trash2, MoreHorizontal, FolderInput, Users, InfoIcon, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface DataTableColumn<T> {
  id: string;
  label: string;
  key: keyof T;
  sortable?: boolean;
  render?: (value: any, row: T) => React.ReactNode;
  width?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  onEdit?: (item: T) => void;
  onMove?: (item: T) => void;
  onGroups?: (item: T) => void;
  onPassword?: (item: T) => void;
  onDelete: (item: T) => void;
  onView?: (item: T) => void;
  searchKey?: keyof T;
  searchValue?: string;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T extends { id?: string; dn?: string }>(
  props: DataTableProps<T>
) {
  const {
    columns,
    data,
    onEdit,
    onMove,
    onGroups,
    onPassword,
    onDelete,
    onView,
    searchKey,
    searchValue = '',
    isLoading = false,
    emptyMessage = 'No data found',
  } = props;

  const [sortConfig, setSortConfig] = useState<{
    key: keyof T | null;
    order: 'asc' | 'desc';
  }>({ key: null, order: 'asc' });

  const filteredData = useMemo(() => {
    if (!searchKey || !searchValue) return data;
    return data.filter((item) => {
      const value = item[searchKey];
      return value?.toString().toLowerCase().includes(searchValue.toLowerCase());
    });
  }, [data, searchKey, searchValue]);

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof T];
      const bValue = b[sortConfig.key as keyof T];

      if (aValue === undefined || bValue === undefined) return 0;

      const comparison = String(aValue).localeCompare(String(bValue));
      return sortConfig.order === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortConfig]);

  const handleSort = (columnKey: keyof T) => {
    setSortConfig((prev) => ({
      key: columnKey,
      order:
        prev.key === columnKey && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (sortedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 rounded-lg border border-border">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {columns.map((column) => (
              <th
                key={column.id}
                className="h-12 px-4 py-2 text-left font-medium text-foreground"
                style={{ width: column.width }}
              >
                {column.sortable ? (
                  <button
                    onClick={() => handleSort(column.key)}
                    className="flex items-center gap-2 hover:text-primary"
                  >
                    {column.label}
                    {sortConfig.key === column.key ? (
                      sortConfig.order === 'asc' ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )
                    ) : null}
                  </button>
                ) : (
                  column.label
                )}
              </th>
            ))}
            <th className="h-12 px-4 py-2 text-left font-medium text-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((item, idx) => (
            <tr
              key={idx}
              className="border-b border-border hover:bg-muted/50 transition-colors"
            >
              {columns.map((column) => (
                <td key={column.id} className="px-4 py-3">
                  {column.render
                    ? column.render(item[column.key], item)
                    : String(item[column.key] ?? '')}
                </td>
              ))}
              <td className="px-4 py-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onView && (
                    <DropdownMenuItem onClick={() => onView(item)}>
                      <InfoIcon className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                  )}
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(item)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                  )}
                  {onPassword && (
                    <DropdownMenuItem onClick={() => onPassword(item)}>
                      <KeyRound className="h-4 w-4 mr-2" />
                      Reset Password
                    </DropdownMenuItem>
                  )}
                  {onMove && (
                    <DropdownMenuItem onClick={() => onMove(item)}>
                      <FolderInput className="h-4 w-4 mr-2" />
                      Move to OU
                    </DropdownMenuItem>
                  )}
                  {onGroups && (
                    <DropdownMenuItem onClick={() => onGroups(item)}>
                      <Users className="h-4 w-4 mr-2" />
                      Manage Groups
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => onDelete(item)}
                    className="text-destructive"
                  >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
