import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SignUpPage from '../app/sign-up/page';
import ApplicationDetailPage from '../app/applications/[id]/page';
import SOSDialog from '../components/home/SOSDialog';
import AddressPicker from '../components/common/AddressPicker';
import { validatePassword } from '../lib/passwordValidation';
import { apiClient } from '../lib/api';
import { useStore } from '../lib/store';

jest.mock('next/navigation',()=>({useParams:()=>({id:'50'}),useRouter:()=>({push:jest.fn(),back:jest.fn()})}));
jest.mock('next/dynamic',()=>()=>()=> <div>Карта</div>);
jest.mock('../components/community/TelegramLink',()=>()=>null);
jest.mock('../components/home/CursorEffect',()=>({children}: {children:React.ReactNode})=><div>{children}</div>);
jest.mock('../components/community/RequestAid',()=>()=>null);
jest.mock('../lib/api',()=>({apiClient:{getApplication:jest.fn(),respondToApplication:jest.fn(),searchLocations:jest.fn(),createSOS:jest.fn()}}));

beforeEach(()=>{
 jest.clearAllMocks();
 useStore.setState({authLoading:false,language:'ru',user:{id:1,email:'admin@example.com',first_name:'Admin',isAdmin:true,is_authenticated:true,city:'Астана'}});
});

test('admin cannot click respond before moderation approval',async()=>{
 jest.mocked(apiClient.getApplication).mockResolvedValue({id:50,description:'Нужна помощь',user_id:2,moderation_status:'pending',category:'food',latitude:43.22,longitude:76.85,date:'2026-11-18',status:'pending',is_sos:false,is_resolved:false,is_false_call:false,priority:0});
 render(<ApplicationDetailPage/>);
 const button=await screen.findByRole('button',{name:'Откликнуться'});
 expect(button).toBeDisabled();fireEvent.click(button);
 expect(apiClient.respondToApplication).not.toHaveBeenCalled();
});

test.each(['RiverStone','riverston8','RIVERSTON8','RiverStone8'])('three password conditions suffice: %s',password=>{
 expect(validatePassword(password).isValid).toBe(true);
});

test('profile location searches automatically use the current profile city',async()=>{
 jest.mocked(apiClient.searchLocations).mockResolvedValue([]);
 render(<AddressPicker value={null} onChange={jest.fn()} />);
 fireEvent.change(screen.getByLabelText('Адрес или название здания'),{target:{value:'Мега'}});
 fireEvent.click(screen.getByRole('button',{name:'Найти'}));
 await waitFor(()=>expect(apiClient.searchLocations).toHaveBeenCalledWith('Мега','Астана'));
});

test('quick SOS with GPS attaches proof without manual map interaction',async()=>{
 Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:jest.fn(success=>success({coords:{latitude:51.16,longitude:71.43}}))}});
 jest.mocked(apiClient.createSOS).mockResolvedValue({success:true,id:51});
 const created=jest.fn();render(<SOSDialog onClose={jest.fn()} onCreated={created}/>);
 expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText(/Фото:/), { target: { files: [new File(['png'], 'proof.png', { type: 'image/png' })] } });
 fireEvent.click(screen.getByRole('button',{name:'Подтвердить и отправить SOS'}));
 await waitFor(()=>expect(created).toHaveBeenCalledWith(51,[51.16,71.43]));
});


test('signup button accepts three conditions and requires matching confirmation',()=>{
 render(<SignUpPage/>);
 fireEvent.change(document.getElementById('password1')!,{target:{value:'RiverStone'}});
 fireEvent.change(document.getElementById('password2')!,{target:{value:'RiverStone'}});
 expect(screen.getByRole('button',{name:'Зарегистрироваться'})).toBeEnabled();
 expect(screen.getByText(/Выполнено 3 из 5/)).toBeInTheDocument();
 fireEvent.change(document.getElementById('password2')!,{target:{value:'Different'}});
 expect(screen.getByRole('button',{name:'Зарегистрироваться'})).toBeDisabled();
});
