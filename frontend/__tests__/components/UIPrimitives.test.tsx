import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';

test('an action button does not submit a form by default and is disabled while busy', () => {
  const submit = jest.fn((event: React.FormEvent) => event.preventDefault());
  const action = jest.fn();

  render(
    <form onSubmit={submit}>
      <Button onClick={action}>Preview</Button>
      <Button busy onClick={action}>Saving</Button>
      <Button type="submit">Submit</Button>
    </form>
  );

  fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
  expect(action).toHaveBeenCalledTimes(1);
  expect(submit).not.toHaveBeenCalled();
  const saving = screen.getByRole('button', { name: 'Saving' });
  expect(saving).toBeDisabled();
  expect(saving).toHaveAttribute('aria-busy', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
  expect(submit).toHaveBeenCalledTimes(1);
});

test('fields tie descriptions and errors to controls and forward registration refs', () => {
  const emailRef = createRef<HTMLInputElement>();
  const descriptionRef = createRef<HTMLTextAreaElement>();

  render(
    <>
      <p id="help">Use your account email.</p>
      <Input id="email" label="Email" ref={emailRef} aria-describedby="help"
        hint="Enter an email address." error="Invalid email address." />
      <Textarea id="description" label="Description" ref={descriptionRef} />
    </>
  );

  const email = screen.getByRole('textbox', { name: 'Email' });
  expect(emailRef.current).toBe(email);
  expect(email).toHaveAccessibleDescription('Use your account email. Enter an email address. Invalid email address.');
  expect(email).toBeInvalid();
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid email address.');
  expect(descriptionRef.current).toBe(screen.getByRole('textbox', { name: 'Description' }));
});
