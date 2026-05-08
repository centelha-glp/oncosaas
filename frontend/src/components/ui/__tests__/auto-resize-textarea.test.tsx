import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AutoResizeTextarea } from '../auto-resize-textarea';

describe('AutoResizeTextarea (scroll)', () => {
  it('não chama scrollIntoView ao digitar (evita scroll jump)', async () => {
    if (!('scrollIntoView' in HTMLElement.prototype)) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        value: () => {},
        writable: true,
      });
    }

    const scrollIntoViewSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => {});

    function Harness() {
      const [value, setValue] = React.useState('linha 1');
      return (
        <AutoResizeTextarea
          aria-label="Evolução clínica (Markdown)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          minRows={3}
        />
      );
    }

    render(<Harness />);
    const textarea = screen.getByLabelText(
      'Evolução clínica (Markdown)'
    ) as HTMLTextAreaElement;

    await userEvent.click(textarea);
    await userEvent.type(textarea, '\nlinha 2');

    expect(scrollIntoViewSpy).not.toHaveBeenCalled();
  });
});

