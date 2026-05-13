'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const navButtonClass = cn(
  buttonVariants({ variant: 'outline' }),
  'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
);

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-2 sm:p-4 bg-background rounded-md', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0 w-full',
        month: 'w-full max-w-full space-y-3',
        month_caption: 'flex justify-center pt-1 pb-2 relative items-center w-full',
        caption_label: 'text-sm font-semibold sm:text-base',
        nav: 'space-x-1 flex items-center',
        button_previous: navButtonClass,
        button_next: navButtonClass,
        month_grid: 'w-full border-collapse',
        weekdays: 'flex w-full gap-1 sm:gap-1.5',
        weekday:
          'text-muted-foreground rounded-md flex-1 min-w-0 font-medium text-[0.7rem] sm:text-xs text-center uppercase tracking-wide',
        weeks: 'flex flex-col w-full gap-1.5 sm:gap-2',
        week: 'flex w-full gap-1 sm:gap-1.5 mt-0',
        day: 'flex-1 min-w-0 text-center text-sm p-0 relative rounded-md [&:has([aria-selected].range-end)]:rounded-r-md [&:has([aria-selected].outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'min-h-10 w-full sm:min-h-12 rounded-md p-0 text-sm sm:text-base font-medium !bg-transparent text-inherit shadow-none hover:!bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        ),
        range_end: 'range-end',
        selected:
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        today: 'bg-accent text-accent-foreground',
        outside:
          'outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
        disabled: 'text-muted-foreground opacity-50',
        range_middle:
          'aria-selected:bg-accent aria-selected:text-accent-foreground',
        range_start: 'range-start',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...chevronProps }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
