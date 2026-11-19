export type Language = 'ru' | 'kk' | 'en';
export const translations: Record<string, readonly [string, string, string]> = {
  'ui.confirm': ['Подтвердить', 'Растау', 'Confirm'],
  'ui.cancel': ['Отмена', 'Бас тарту', 'Cancel'],
  'ui.close': ['Закрыть', 'Жабу', 'Close'],
  'ui.action.error': ['Не удалось выполнить действие', 'Әрекетті орындау мүмкін болмады', 'Could not complete the action'],
  'ui.status': ['Статус заявки', 'Өтінім күйі', 'Request status'],
  'status.active': ['Все активные', 'Барлық белсенді', 'All active'],
  'status.open': ['Открыта', 'Ашық', 'Open'],
  'status.pending': ['На модерации', 'Тексерілуде', 'Pending moderation'],
  'status.in_progress': ['В работе', 'Орындалуда', 'In progress'],
  'status.completed': ['Завершена', 'Аяқталды', 'Completed'],
  'status.rejected': ['Отклонена', 'Қабылданбады', 'Rejected'],
  'status.approved': ['Одобрена', 'Мақұлданды', 'Approved'],
  'status.false_call': ['Ложная заявка', 'Жалған өтінім', 'False request'],
  'status.expired': ['Срок истёк', 'Мерзімі аяқталды', 'Expired'],
  'status.unknown': ['Статус неизвестен', 'Күйі белгісіз', 'Unknown status'],
  'ui.priority': ['Приоритет {value} из 5', 'Басымдық {value}/5', 'Priority {value} out of 5'],
  'ui.rating': ['Оценка помощи', 'Көмекті бағалау', 'Rate the help'],
  'ui.loading': ['Загрузка…', 'Жүктелуде…', 'Loading…'],
  'admin.quickActions': ['Быстрые действия', 'Жылдам әрекеттер', 'Quick actions'],
  'admin.users.title': ['Управление пользователями', 'Пайдаланушыларды басқару', 'Manage users'],
  'admin.stats.title': ['Статистика', 'Статистика', 'Statistics'],
  'admin.categoryStats': ['Статистика по категориям', 'Санаттар бойынша статистика', 'Requests by category'],
  'admin.metric.total_applications': ['Всего заявок', 'Барлық өтінімдер', 'Total requests'],
  'admin.metric.pending_applications': ['На модерации', 'Тексерілуде', 'Pending moderation'],
  'admin.metric.approved_applications': ['Одобренные', 'Мақұлданған', 'Approved'],
  'admin.metric.rejected_applications': ['Отклонённые', 'Қабылданбаған', 'Rejected'],
  'admin.metric.total_responses': ['Отклики', 'Жауаптар', 'Responses'],
  'admin.metric.volunteers_count': ['Волонтёры', 'Еріктілер', 'Volunteers'],
  'admin.metric.false_calls_count': ['Ложные заявки', 'Жалған өтінімдер', 'False requests'],
  'admin.moderation.title': ['Модерация заявок', 'Өтінімдерді тексеру', 'Request moderation'],
  'admin.moderation.reason': ['Причина отклонения (1–1000 символов)', 'Бас тарту себебі (1–1000 таңба)', 'Rejection reason (1–1000 characters)'],
  'admin.moderation.approve': ['Одобрить', 'Мақұлдау', 'Approve'],
  'admin.moderation.approvePrompt': ['Одобрить эту заявку?', 'Осы өтінім мақұлдансын ба?', 'Approve this request?'],
  'admin.moderation.reject': ['Отклонить', 'Қабылдамау', 'Reject'],
  'admin.moderation.rejectPrompt': ['Отклонить заявку и отправить причину автору?', 'Өтінімді қабылдамай, себебін авторға жіберу керек пе?', 'Reject the request and notify the author of the reason?'],
  'admin.moderation.falsePrompt': ['Пометить заявку как ложную?', 'Өтінім жалған деп белгіленсін бе?', 'Mark this request as false?'],
  'admin.moderation.priority': ['Сменить приоритет', 'Басымдықты өзгерту', 'Change priority'],
  'admin.moderation.priorityPrompt': ['Установить выбранный приоритет?', 'Таңдалған басымдық орнатылсын ба?', 'Apply the selected priority?'],
  'admin.moderation.sosReview': ['Опубликована, ожидает проверки', 'Жарияланды, тексеруді күтуде', 'Published and awaiting review'],
  'admin.responsesCount': ['Откликов: {count}', 'Жауаптар: {count}', 'Responses: {count}'],
  'review.title': ['Оцените помощников', 'Көмекшілерді бағалаңыз', 'Rate your helpers'],
  'review.helper': ['Помощник', 'Көмекші', 'Helper'],
  'review.comment': ['Отзыв (необязательно)', 'Пікір (міндетті емес)', 'Review (optional)'],
  'review.submit': ['Оценить помощь', 'Көмекті бағалау', 'Submit rating'],
  'review.hide': ['Скрыть текст отзыва', 'Пікір мәтінін жасыру', 'Hide review text'],
  'review.hidePrompt': ['Скрыть текст этого отзыва из профиля?', 'Бұл пікірдің мәтіні профильден жасырылсын ба?', 'Hide the text of this review from the profile?'],
  'review.request': ['Заявка {id}', 'Өтінім {id}', 'Request {id}'],
  'request.authorContact': ['Контакт автора', 'Автордың байланыс дерегі', 'Requester contact'],
  'request.noContact': ['Контакт не указан', 'Байланыс дерегі көрсетілмеген', 'No contact provided'],
  'request.resolveConfirm': ['Подтвердить, что помощь получена?', 'Көмек алынғанын растайсыз ба?', 'Confirm that help was received?'],
  'application.resolve': ['Отметить как решённую', 'Шешілді деп белгілеу', 'Mark as resolved'],
  'notifications.title': ['Уведомления', 'Хабарландырулар', 'Notifications'],
  'notifications.readAll': ['Прочитать всё', 'Барлығын оқу', 'Mark all as read'],
  'notifications.empty': ['Нет уведомлений', 'Хабарландырулар жоқ', 'No notifications'],
  'nav.news': ['Новости', 'Жаңалықтар', 'News'],
  'nav.resources': ['Ресурсы', 'Ресурстар', 'Resources'],
  'signup.validEmail': ['Введите корректный адрес электронной почты', 'Дұрыс электрондық пошта мекенжайын енгізіңіз', 'Enter a valid email address'],
  'signup.required': ['Заполните это поле', 'Осы өрісті толтырыңыз', 'Fill in this field'],
  'signup.phone': ['Номер телефона', 'Телефон нөмірі', 'Phone number'],
  'signup.phoneHint': ['Введите 10 цифр номера после +7', '+7 кодынан кейін 10 сан енгізіңіз', 'Enter 10 digits after +7'],
  'signup.city': ['Город проживания', 'Тұратын қала', 'City of residence'],
  'signup.hideCity': ['Скрыть город в публичном профиле', 'Қаланы ашық профильде жасыру', 'Hide my city on my public profile'],
  'signup.passwordHint': ['От 8 до 128 символов и минимум два вида символов: заглавные, строчные, цифры или знаки. Избегайте простых последовательностей.', '8–128 таңба, кемінде екі таңба түрі: бас әріп, кіші әріп, сан немесе белгі. Қарапайым тізбектерді қолданбаңыз.', 'Use 8–128 characters and at least two of uppercase, lowercase, digits, and symbols. Avoid simple sequences.'],
  'signup.passwordChecks': ['Выполнено {count} из 5 проверок', '5 тексерудің {count}-і орындалды', '{count} of 5 checks passed'],
  'signup.passwordMismatch': ['Пароли не совпадают', 'Құпиясөздер сәйкес келмейді', 'The passwords do not match'],
  'signup.showPasswords': ['Показать пароли', 'Құпиясөздерді көрсету', 'Show passwords'],
  'signup.hidePasswords': ['Скрыть пароли', 'Құпиясөздерді жасыру', 'Hide passwords'],
  'home.helpOthers': ['Хочу помочь', 'Көмектескім келеді', 'I want to help'],
  'home.requestMap': ['Карта заявок', 'Өтінімдер картасы', 'Request map'],
  'home.city': ['Город', 'Қала', 'City'],
  'home.requestFilter': ['Какие заявки показать', 'Қандай өтінімдерді көрсету керек', 'Requests to show'],
  'home.allRequests': ['Все заявки', 'Барлық өтінімдер', 'All requests'],
  'home.matchingRequests': ['Подходящие мне', 'Маған сәйкес', 'Matches for me'],
  'home.noMatches': ['Совпадений пока нет.', 'Сәйкес өтінімдер әзірге жоқ.', 'There are no matches yet.'],
  'home.preferences': ['Настроить возможности', 'Мүмкіндіктерді баптау', 'Edit capabilities'],
  'home.retry': ['Повторить загрузку', 'Қайта жүктеу', 'Retry'],
  'home.loadError': ['Не удалось загрузить заявки', 'Өтінімдерді жүктеу мүмкін болмады', 'Could not load requests'],
  'home.mapLoading': ['Загрузка карты…', 'Карта жүктелуде…', 'Loading map…'],
  'home.mapSOS': ['Отправить SOS с карты', 'Картадан SOS жіберу', 'Send SOS from the map'],
  'resources.title': ['Ресурсы рядом', 'Жақын жердегі ресурстар', 'Resources nearby'],
  'resources.description': ['Здесь предлагают ресурсы и показывают точки помощи.', 'Мұнда ресурстар мен көмек пункттері көрсетіледі.', 'Find available resources and aid locations.'],
  'resources.type': ['Тип ресурса', 'Ресурс түрі', 'Resource type'],
  'resources.allTypes': ['Все типы ресурсов', 'Барлық ресурс түрлері', 'All resource types'],
  'resources.medicine': ['Аптеки и медицина', 'Дәріханалар мен медицина', 'Pharmacies and medical help'],
  'resources.shelters': ['Убежища', 'Баспаналар', 'Shelters'],
  'request.create.title': ['Попросить помощь', 'Көмек сұрау', 'Request help'],
  'request.create.description': ['Опишите ситуацию и какая помощь нужна', 'Жағдайды және қандай көмек қажет екенін сипаттаңыз', 'Describe the situation and what help is needed'],
  'request.create.descriptionError': ['Описание должно содержать от 10 до 1000 символов', 'Сипаттама 10–1000 таңбадан тұруы тиіс', 'Description must be 10–1000 characters'],
  'request.create.review': ['Заявка появится на карте после проверки.', 'Өтінім тексерілгеннен кейін картада көрінеді.', 'The request appears on the map after review.'],
  'request.create.submit': ['Отправить на проверку', 'Тексеруге жіберу', 'Submit for review'],
  'request.create.photos': ['Фото: от 1 до 3, JPEG/PNG, до 10 МБ каждое', '1–3 JPEG/PNG фотосуреті, әрқайсысы 10 МБ дейін', 'Photos: 1–3 JPEG/PNG files, up to 10 MB each'],
  'request.create.location': ['Где нужна помощь', 'Көмек қай жерде қажет', 'Where help is needed'],
  'request.create.locationError': ['Найдите адрес или выберите точку на карте', 'Мекенжайды табыңыз немесе картадан нүкте таңдаңыз', 'Find an address or select a point on the map'],
  'location.selectedPoint': ['Точка выбрана на карте', 'Нүкте картадан таңдалды', 'Point selected on the map'],
  'location.selected': ['Выбрано: {address}', 'Таңдалды: {address}', 'Selected: {address}'],
  'request.create.deliveryError': ['Выберите, откуда забрать и куда доставить', 'Алып кету және жеткізу орнын таңдаңыз', 'Select the pickup and drop-off locations'],
  'request.create.needsError': ['Укажите название, единицу измерения и положительное количество ресурса', 'Ресурстың атауын, өлшем бірлігін және оң санын көрсетіңіз', 'Enter a resource name, unit and positive quantity'],
  'request.create.capabilities': ['Какие возможности нужны помощнику?', 'Көмекші не істей алуы керек?', 'What can the helper do?'],
  'capability.has_car': ['Есть автомобиль', 'Көлігі бар', 'Has a car'],
  'capability.deliver_food': ['Может доставить продукты', 'Азық-түлік жеткізе алады', 'Can deliver food'],
  'capability.transport_items': ['Может перевозить вещи', 'Заттарды таси алады', 'Can transport items'],
  'capability.translate': ['Может переводить', 'Аудара алады', 'Can translate'],
  'capability.household_help': ['Может помочь по дому', 'Үй шаруасына көмектесе алады', 'Can help around the house'],
  'capability.title': ['Ваши возможности помочь', 'Көмек көрсету мүмкіндіктеріңіз', 'Ways you can help'],
  'capability.save': ['Сохранить возможности', 'Мүмкіндіктерді сақтау', 'Save capabilities'],
  'capability.saved': ['Возможности сохранены', 'Мүмкіндіктер сақталды', 'Capabilities saved'],
  'capability.later': ['Позже', 'Кейінірек', 'Later'],
  'profile.title': ['Мой профиль', 'Менің профилім', 'My profile'],
  'profile.track': ['Обновлять точку, пока открыта эта страница', 'Осы бет ашық кезде орынды жаңарту', 'Update my location while this page is open'],
  'profile.trackError': ['Не удалось обновить местоположение. Проверьте разрешение браузера.', 'Орналасқан жер жаңартылмады. Браузер рұқсатын тексеріңіз.', 'Could not update your location. Check your browser permissions.'],
  'category.food': ['Продукты', 'Азық-түлік', 'Food'],
  'category.clothing': ['Вещи', 'Киім мен заттар', 'Clothing and supplies'],
  'category.household': ['Бытовая помощь', 'Тұрмыстық көмек', 'Household help'],
  'category.delivery': ['Доставка', 'Жеткізу', 'Delivery'],
  'category.volunteering': ['Волонтёрство', 'Еріктілік', 'Volunteering'],
  'category.social_project': ['Социальные инициативы', 'Әлеуметтік бастамалар', 'Social initiatives'],
  'category.medicine': ['Медицина', 'Медицина', 'Medical help'],
  'category.shelter': ['Убежище', 'Баспана', 'Shelter'],
  'category.emergency': ['Экстренная помощь', 'Шұғыл көмек', 'Emergency aid'],
  'category.unknown': ['Другое', 'Басқа', 'Other'],
  "auth.login.noAccount": ["Нет аккаунта?", "Аккаунтыңыз жоқ па?", "No account?"],
  "auth.login.createAccount": ["Создать аккаунт", "Аккаунт жасау", "Create an account"],
  "categories.any": ["Любая категория", "Кез келген санат", "Any category"],
  "priorities.normal": ["Обычный", "Қалыпты", "Normal"],
  "priorities.high": ["Высокий", "Жоғары", "High"],
  "priorities.sos": ["Экстренный SOS", "Шұғыл SOS", "Emergency SOS"],
  "categories.clothing": ["Вещи", "Киім мен заттар", "Clothing and essentials"],
  "categories.household": ["Бытовая помощь", "Тұрмыстық көмек", "Everyday help"],
  "categories.delivery": ["Доставка", "Жеткізу", "Delivery"],
  "categories.volunteering": ["Волонтёрство", "Еріктілік", "Volunteering"],
  "categories.social_project": ["Социальные инициативы", "Әлеуметтік бастамалар", "Social initiatives"],

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
    "Платформа взаимопомощи и экстренного реагирования",
    "Өзара көмек және төтенше жағдайларға әрекет ету платформасы",
    "Mutual aid and emergency response"
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
    "Помощь с продуктами, вещами, бытовыми задачами и социальными инициативами",
    "Күнделікті көмек, ресурстармен бөлісу және әлеуметтік бастамалар",
    "Everyday help, shared resources, volunteering and social initiatives"
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

