export type Language = 'ru' | 'kk' | 'en';
export const translations: Record<string, readonly [string, string, string]> = {
  "admin.applications.approveError": [
    "Не удалось одобрить заявку",
    "Өтінімді мақұлдау мүмкін болмады",
    "Could not approve the request"
  ],
  "admin.applications.markError": [
    "Не удалось отметить заявку",
    "Өтінімді белгілеу мүмкін болмады",
    "Could not mark the request"
  ],
  "admin.applications.noApplications": [
    "Заявок нет",
    "Өтінімдер жоқ",
    "No requests"
  ],
  "admin.applications.priorityError": [
    "Не удалось изменить приоритет",
    "Басымдықты өзгерту мүмкін болмады",
    "Could not change priority"
  ],
  "admin.applications.rejectError": [
    "Не удалось отклонить заявку",
    "Өтінімді қабылдамау мүмкін болмады",
    "Could not reject the request"
  ],
  "admin.title": [
    "Панель администратора",
    "Әкімші панелі",
    "Administration"
  ],
  "admin.users.adminError": [
    "Не удалось назначить администратора",
    "Әкімшіні тағайындау мүмкін болмады",
    "Could not assign administrator"
  ],
  "admin.users.applications": [
    "Заявки",
    "Өтінімдер",
    "Requests"
  ],
  "admin.users.blockError": [
    "Не удалось заблокировать пользователя",
    "Пайдаланушыны бұғаттау мүмкін болмады",
    "Could not block user"
  ],
  "admin.users.deleteError": [
    "Не удалось удалить пользователя",
    "Пайдаланушыны жою мүмкін болмады",
    "Could not delete user"
  ],
  "admin.users.noApplications": [
    "Заявок нет",
    "Өтінімдер жоқ",
    "No requests"
  ],
  "admin.users.totalApplications": [
    "Всего заявок",
    "Барлық өтінімдер",
    "Total requests"
  ],
  "admin.users.unblockError": [
    "Не удалось разблокировать пользователя",
    "Бұғаттаудан шығару мүмкін болмады",
    "Could not unblock user"
  ],
  "alerts.geolocationNotSupported": [
    "Браузер не поддерживает геолокацию",
    "Браузер геолокацияны қолдамайды",
    "Geolocation is not supported"
  ],
  "alerts.locationError": [
    "Не удалось определить местоположение",
    "Орналасқан жерді анықтау мүмкін болмады",
    "Could not determine location"
  ],
  "alerts.loginError": [
    "Не удалось войти",
    "Кіру мүмкін болмады",
    "Sign-in failed"
  ],
  "alerts.loginErrorDetail": [
    "Проверьте почту и пароль",
    "Пошта мен құпиясөзді тексеріңіз",
    "Check your email and password"
  ],
  "alerts.profileSaveError": [
    "Не удалось сохранить профиль",
    "Профильді сақтау мүмкін болмады",
    "Could not save profile"
  ],
  "alerts.ratingError": [
    "Не удалось отправить оценку",
    "Бағаны жіберу мүмкін болмады",
    "Could not submit rating"
  ],
  "alerts.ratingNegative": [
    "Отрицательная оценка сохранена",
    "Теріс баға сақталды",
    "Negative rating saved"
  ],
  "alerts.ratingPositive": [
    "Положительная оценка сохранена",
    "Оң баға сақталды",
    "Positive rating saved"
  ],
  "alerts.registrationError": [
    "Не удалось зарегистрироваться",
    "Тіркелу мүмкін болмады",
    "Registration failed"
  ],
  "alerts.registrationErrorDetail": [
    "Проверьте введённые данные",
    "Енгізілген деректерді тексеріңіз",
    "Check the information you entered"
  ],
  "alerts.resolvedError": [
    "Не удалось завершить заявку",
    "Өтінімді аяқтау мүмкін болмады",
    "Could not resolve request"
  ],
  "alerts.resolvedSuccess": [
    "Заявка завершена",
    "Өтінім аяқталды",
    "Request resolved"
  ],
  "alerts.respondError": [
    "Не удалось откликнуться",
    "Жауап беру мүмкін болмады",
    "Could not respond"
  ],
  "alerts.respondSuccess": [
    "Отклик отправлен",
    "Жауап жіберілді",
    "Response sent"
  ],
  "alerts.sosError": [
    "Не удалось отправить SOS",
    "SOS жіберу мүмкін болмады",
    "Could not send SOS"
  ],
  "alerts.sosSent": [
    "Сигнал SOS отправлен",
    "SOS сигналы жіберілді",
    "SOS sent"
  ],
  "application.form.category": [
    "Категория",
    "Санат",
    "Category"
  ],
  "application.form.characters": [
    "символов",
    "таңба",
    "characters"
  ],
  "application.form.days14": [
    "14 дней",
    "14 күн",
    "14 days"
  ],
  "application.form.days3": [
    "3 дня",
    "3 күн",
    "3 days"
  ],
  "application.form.days30": [
    "30 дней",
    "30 күн",
    "30 days"
  ],
  "application.form.days7": [
    "7 дней",
    "7 күн",
    "7 days"
  ],
  "application.form.description": [
    "Описание",
    "Сипаттама",
    "Description"
  ],
  "application.form.descriptionPlaceholder": [
    "Опишите, какая помощь нужна",
    "Қандай көмек қажет екенін сипаттаңыз",
    "Describe the help you need"
  ],
  "application.form.descriptionRequired": [
    "Добавьте описание",
    "Сипаттама қосыңыз",
    "Add a description"
  ],
  "application.form.expires": [
    "Срок действия",
    "Жарамдылық мерзімі",
    "Duration"
  ],
  "application.form.locationRequired": [
    "Укажите местоположение",
    "Орналасқан жерді көрсетіңіз",
    "Choose a location"
  ],
  "application.form.selectLocation": [
    "Выберите место на карте",
    "Картадан орынды таңдаңыз",
    "Choose a location on the map"
  ],
  "application.form.selected": [
    "Выбрано",
    "Таңдалды",
    "Selected"
  ],
  "application.form.submit": [
    "Создать заявку",
    "Өтінім жасау",
    "Create request"
  ],
  "application.form.submitError": [
    "Не удалось создать заявку",
    "Өтінім жасау мүмкін болмады",
    "Could not create request"
  ],
  "application.form.submitting": [
    "Отправка…",
    "Жіберілуде…",
    "Submitting…"
  ],
  "application.form.subtitle": [
    "Укажите, какая помощь вам нужна и где",
    "Қандай көмек қажет екенін және орынды көрсетіңіз",
    "Tell us what help you need and where"
  ],
  "application.form.title": [
    "Новая заявка",
    "Жаңа өтінім",
    "New request"
  ],
  "application.location": [
    "Местоположение",
    "Орналасқан жері",
    "Location"
  ],
  "application.priority": [
    "Приоритет",
    "Басымдық",
    "Priority"
  ],
  "auth.login.email": [
    "Электронная почта",
    "Электрондық пошта",
    "Email"
  ],
  "auth.login.password": [
    "Пароль",
    "Құпиясөз",
    "Password"
  ],
  "auth.login.signupLink": [
    "Создать аккаунт",
    "Аккаунт жасау",
    "Create an account"
  ],
  "auth.login.submit": [
    "Войти",
    "Кіру",
    "Sign in"
  ],
  "auth.login.subtitle": [
    "Войдите в свой аккаунт ASAR",
    "ASAR аккаунтыңызға кіріңіз",
    "Sign in to your ASAR account"
  ],
  "auth.login.title": [
    "Вход",
    "Кіру",
    "Sign in"
  ],
  "auth.signup.confirmPassword": [
    "Повторите пароль",
    "Құпиясөзді қайталаңыз",
    "Confirm password"
  ],
  "auth.signup.email": [
    "Электронная почта",
    "Электрондық пошта",
    "Email"
  ],
  "auth.signup.firstName": [
    "Имя",
    "Аты",
    "First name"
  ],
  "auth.signup.lastName": [
    "Фамилия",
    "Тегі",
    "Last name"
  ],
  "auth.signup.loginLink": [
    "Уже есть аккаунт? Войти",
    "Аккаунтыңыз бар ма? Кіру",
    "Already have an account? Sign in"
  ],
  "auth.signup.password": [
    "Пароль",
    "Құпиясөз",
    "Password"
  ],
  "auth.signup.passwordRequirements.lowercase": [
    "Строчная буква",
    "Кіші әріп",
    "Lowercase letter"
  ],
  "auth.signup.passwordRequirements.minLength": [
    "Не менее 8 символов",
    "Кемінде 8 таңба",
    "At least 8 characters"
  ],
  "auth.signup.passwordRequirements.number": [
    "Цифра",
    "Сан",
    "Number"
  ],
  "auth.signup.passwordRequirements.special": [
    "Специальный символ",
    "Арнайы таңба",
    "Special character"
  ],
  "auth.signup.passwordRequirements.title": [
    "Требования к паролю",
    "Құпиясөз талаптары",
    "Password requirements"
  ],
  "auth.signup.passwordRequirements.uppercase": [
    "Заглавная буква",
    "Бас әріп",
    "Uppercase letter"
  ],
  "auth.signup.passwordStrength.medium": [
    "Средний",
    "Орташа",
    "Medium"
  ],
  "auth.signup.passwordStrength.strong": [
    "Надёжный",
    "Сенімді",
    "Strong"
  ],
  "auth.signup.passwordStrength.weak": [
    "Слабый",
    "Әлсіз",
    "Weak"
  ],
  "auth.signup.submit": [
    "Зарегистрироваться",
    "Тіркелу",
    "Sign up"
  ],
  "auth.signup.subtitle": [
    "Присоединяйтесь к сообществу взаимопомощи",
    "Өзара көмек қауымдастығына қосылыңыз",
    "Join our community of mutual support"
  ],
  "auth.signup.title": [
    "Регистрация",
    "Тіркелу",
    "Sign up"
  ],
  "categories.emergency": [
    "Экстренная помощь",
    "Шұғыл көмек",
    "Emergency"
  ],
  "categories.food": [
    "Продукты",
    "Азық-түлік",
    "Food"
  ],
  "categories.medicine": [
    "Медицина",
    "Медицина",
    "Medicine"
  ],
  "categories.shelter": [
    "Убежище",
    "Баспана",
    "Shelter"
  ],
  "common.cancel": [
    "Отмена",
    "Болдырмау",
    "Cancel"
  ],
  "common.loading": [
    "Загрузка…",
    "Жүктелуде…",
    "Loading…"
  ],
  "common.more": [
    "Подробнее",
    "Толығырақ",
    "Details"
  ],
  "common.notSpecified": [
    "Не указано",
    "Көрсетілмеген",
    "Not specified"
  ],
  "footer.contact": [
    "Контакты",
    "Байланыс",
    "Contact"
  ],
  "footer.description": [
    "Платформа экстренной помощи и обмена ресурсами",
    "Шұғыл көмек және ресурстармен алмасу платформасы",
    "Emergency aid and resource sharing"
  ],
  "footer.quickLinks": [
    "Разделы",
    "Бөлімдер",
    "Quick links"
  ],
  "footer.rights": [
    "Все права защищены",
    "Барлық құқықтар қорғалған",
    "All rights reserved"
  ],
  "home.cta.button": [
    "Создать заявку",
    "Өтінім жасау",
    "Create request"
  ],
  "home.cta.description": [
    "Расскажите о своей ситуации сообществу",
    "Жағдайыңызды қауымдастыққа айтыңыз",
    "Tell the community what you need"
  ],
  "home.cta.title": [
    "Нужна помощь?",
    "Көмек керек пе?",
    "Need help?"
  ],
  "home.hero.createApplication": [
    "Создать заявку",
    "Өтінім жасау",
    "Create request"
  ],
  "home.hero.subtitle": [
    "Помогаем друг другу, делимся ресурсами",
    "Бір-бірімізге көмектесіп, ресурстармен бөлісеміз",
    "Help each other and share resources"
  ],
  "home.hero.title": [
    "Помощь рядом",
    "Көмек жақын",
    "Help is nearby"
  ],
  "home.hero.viewAll": [
    "Все заявки",
    "Барлық өтінімдер",
    "All requests"
  ],
  "home.noApplications": [
    "В этом городе пока нет заявок",
    "Бұл қалада әлі өтінімдер жоқ",
    "No requests in this city yet"
  ],
  "home.viewList": [
    "Список",
    "Тізім",
    "List"
  ],
  "home.viewMap": [
    "Карта",
    "Карта",
    "Map"
  ],
  "nav.about": [
    "О проекте",
    "Жоба туралы",
    "About"
  ],
  "nav.applications": [
    "Заявки",
    "Өтінімдер",
    "Requests"
  ],
  "nav.home": [
    "Главная",
    "Басты бет",
    "Home"
  ],
  "nav.login": [
    "Войти",
    "Кіру",
    "Sign in"
  ],
  "nav.logout": [
    "Выйти",
    "Шығу",
    "Sign out"
  ],
  "nav.profile": [
    "Профиль",
    "Профиль",
    "Profile"
  ],
  "nav.signup": [
    "Регистрация",
    "Тіркелу",
    "Sign up"
  ],
  "search.applications": [
    "Заявки",
    "Өтінімдер",
    "Requests"
  ],
  "search.applicationsCount": [
    "Заявок: {count}",
    "Өтінімдер: {count}",
    "Requests: {count}"
  ],
  "search.cities": [
    "Города",
    "Қалалар",
    "Cities"
  ],
  "search.noResults": [
    "Ничего не найдено",
    "Ештеңе табылмады",
    "No results"
  ],
  "search.placeholder": [
    "Поиск заявок, людей и городов",
    "Өтінімдер, адамдар және қалаларды іздеу",
    "Search requests, people and cities"
  ],
  "search.resultsCount": [
    "Найдено: {count}",
    "Табылды: {count}",
    "Results: {count}"
  ],
  "search.users": [
    "Пользователи",
    "Пайдаланушылар",
    "People"
  ],
  "stats.activeApplications": [
    "Активные заявки",
    "Белсенді өтінімдер",
    "Active requests"
  ],
  "stats.emergencyApplications": [
    "Экстренные заявки",
    "Шұғыл өтінімдер",
    "Emergency requests"
  ],
  "stats.totalInRegion": [
    "Всего в регионе",
    "Аймақтағы барлығы",
    "Total in region"
  ]
};
export function getLanguage(): Language {
  if (typeof window === 'undefined') return 'ru';
  const value = localStorage.getItem('language');
  return value === 'kk' || value === 'en' ? value : 'ru';
}
export function useTranslation(language: Language) {
  return (key: string, params?: Record<string, string | number>): string => {
    let text = translations[key]?.[({ ru: 0, kk: 1, en: 2 })[language]] || key;
    for (const [name, value] of Object.entries(params || {})) text = text.replaceAll('{' + name + '}', String(value));
    return text;
  };
}

