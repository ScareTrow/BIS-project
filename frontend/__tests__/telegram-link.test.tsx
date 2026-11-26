import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TelegramLink from '../components/community/TelegramLink';
import { apiClient } from '../lib/api';
import { completePhone, nationalPhoneDigits } from '../lib/phone';

jest.mock('../lib/api', () => ({ apiClient: {
  getTelegramBotInfo: jest.fn(), createTelegramLink: jest.fn(), getSession: jest.fn(),
} }));

beforeEach(() => jest.clearAllMocks());

test.each(['7771234567', '+7 (777) 123-45-67', '8 777 123 45 67'])(
  'normalizes national or pasted full phone %s without duplicating +7', value => {
    const digits = nationalPhoneDigits(value);
    expect(digits).toBe('7771234567');
    expect(completePhone(digits)).toBe('+77771234567');
  },
);

test('guests can open the bot without creating an account binding', async () => {
  jest.mocked(apiClient.getTelegramBotInfo).mockResolvedValue({ bot_url: 'https://t.me/asar_test_bot' });
  render(<TelegramLink guest />);
  expect(await screen.findByRole('link', { name: 'Открыть Telegram-бота' })).toHaveAttribute('href', 'https://t.me/asar_test_bot');
  expect(apiClient.createTelegramLink).not.toHaveBeenCalled();
  expect(screen.getByText(/Сначала завершите регистрацию/)).toBeInTheDocument();
});

test('signed link is displayed and the returned Telegram ID updates the form on focus', async () => {
  jest.mocked(apiClient.createTelegramLink).mockResolvedValue({ bot_url: 'https://t.me/asar_test_bot?start=link_nonce', expires_in: 600 });
  jest.mocked(apiClient.getSession).mockResolvedValue({ user: { id: 1, email: 'test@example.com', first_name: 'User', isAdmin: false, telegram_id: '123456', rating_sum: 5, rating_count: 1 } });
  const onLinked = jest.fn();
  render(<TelegramLink onLinked={onLinked} />);
  expect(apiClient.createTelegramLink).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Привязать Telegram' }));
  expect(await screen.findByRole('link', { name: 'Открыть Telegram-бота' })).toHaveAttribute('href', 'https://t.me/asar_test_bot?start=link_nonce');
  fireEvent.focus(window);
  await waitFor(() => expect(onLinked).toHaveBeenCalledWith('123456'));
  expect(screen.getByRole('status')).toHaveTextContent('Telegram привязан');
});
