import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ResourcesPage from '../app/resources/page';
import { communityApi } from '../lib/community-api';
import { useStore } from '../lib/store';

jest.mock('next/dynamic', () => () => () => <div>Карта ресурсов</div>);
jest.mock('../lib/community-api', () => ({ communityApi: { resources: jest.fn().mockResolvedValue([]) } }));

test('category dropdown filters resource cards and replaces city search', async () => {
  useStore.setState({ user: null, authLoading: false, language: 'ru' });
  render(<ResourcesPage />);
  await waitFor(() => expect(communityApi.resources).toHaveBeenCalledWith(''));
  expect(screen.queryByLabelText('Фильтр по городу')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Тип ресурса'), { target: { value: 'medicine' } });
  await waitFor(() => expect(communityApi.resources).toHaveBeenCalledWith('medicine'));
  expect(screen.getByRole('option', { name: 'Убежища' })).toBeInTheDocument();
});
