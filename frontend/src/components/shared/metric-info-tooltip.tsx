'use client';

import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

interface MetricInfoTooltipProps {
  title: string;
  description: string;
  calculation: string;
}

export function MetricInfoTooltip({
  title,
  description,
  calculation,
}: MetricInfoTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-semibold text-gray-900">{title}</p>
          <p className="text-gray-600">{description}</p>
          <p className="text-gray-500">
            <span className="font-medium">Como é calculado: </span>
            {calculation}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
