from aiogram.fsm.state import State, StatesGroup


class ApplicationStates(StatesGroup):
    waiting_category = State()
    waiting_description = State()
    waiting_photo = State()
    waiting_location = State()
    waiting_sos_location = State()
    waiting_volunteer_location = State()

