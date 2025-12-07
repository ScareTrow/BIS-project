from aiogram.fsm.state import State, StatesGroup


class ApplicationStates(StatesGroup):
    waiting_description = State()
    waiting_location = State()
    waiting_sos_location = State()

