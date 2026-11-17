import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RequestAid from '../components/community/RequestAid';
import { communityApi } from '../lib/community-api';

jest.mock('../lib/community-api', () => ({ communityApi: {
  capabilities: jest.fn().mockResolvedValue([]),
  aid: jest.fn().mockResolvedValue({capabilities:[],response_id:7,rated_response_ids:[],
    needs:[{id:2,resource_name:'Вода',unit:'л',quantity_needed:10,quantity_delivered:5,still_needed:5}],
    contributions:[{id:3,need_id:2,response_id:7,quantity_delivered:2,status:'delivered'}]}),
  contribute: jest.fn().mockResolvedValue({}),
} }));

test('helpers update only actual deliveries within the shared remaining quantity', async () => {
  const changed = jest.fn();
  const responses = [{id:7,responder_id:9,status:'accepted',created_at:'2026-11-17T10:00:00Z'}];
  render(<RequestAid applicationId={1} responses={responses} isAuthor={false} onChange={changed} />);
  const quantity = await screen.findByLabelText('Доставлено Вода');
  expect(quantity).toHaveAttribute('min','2');
  expect(quantity).toHaveAttribute('max','7');
  expect(screen.queryByText(/Обеща|обеща/)).not.toBeInTheDocument();
  fireEvent.change(quantity,{target:{value:'6'}});
  expect(quantity).toHaveAttribute('max','7');
  fireEvent.submit(quantity.closest('form')!);
  await waitFor(()=>expect(communityApi.contribute).toHaveBeenCalledWith(7,{need_id:2,quantity_delivered:6}));
  expect(changed).toHaveBeenCalled();
});
